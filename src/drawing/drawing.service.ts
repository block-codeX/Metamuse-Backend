import { Injectable, Logger } from '@nestjs/common';
import { CreateDrawingDto } from './dto/create-drawing.dto';
import { UpdateDrawingDto } from './dto/update-drawing.dto';
import * as Y from 'yjs';
import { Server, Socket } from 'socket.io';
import { RedisPersistence, PersistenceDoc } from 'y-redis';
import { ConversationService } from 'src/conversation/conversation.service';
import { InjectModel } from '@nestjs/mongoose';
// @ts-ignore
import { WebsocketProvider } from 'y-websocket';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Project } from './drawing.schema';
import BaseError, {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@app/utils/utils.errors';
import { CONVERSATION_MAX_MEMBERS, PaginatedDocs, paginate } from '@app/utils';
@Injectable()
export class CRDTService {
  private readonly logger = new Logger(CRDTService.name);
  private documents = new Map<string, Y.Doc>();
  private persistence = new Map<string, PersistenceDoc>();

  constructor(
    private readonly drawingService: DrawingService,
    private readonly redisConfig: any,
    @InjectModel(Project.name) private drawingModel: Model<Project>,

  ) {}

  async getDocument(projectId: string): Promise<Y.Doc> {
    if (!this.documents.has(projectId)) {
      return await this.createDocument(projectId);
    }
    return this.documents.get(projectId) as Y.Doc;
  }

  async createDocument(projectId: string): Promise<Y.Doc> {
    const doc = new Y.Doc();
    const yRedis = new RedisPersistence(this.redisConfig);
    const persistenceDoc = yRedis.bindState(projectId, doc);
    this.documents.set(projectId, doc);
    this.persistence.set(projectId, persistenceDoc);
    doc.getMap('metadata');
    doc.getMap('metadata').set('projectId', projectId);
    doc.getMap('canvas');
    doc.getMap('objects');
    await this.drawingService.loadFromMongoDB(projectId, doc);
    return doc;
  }
  // 3. Apply fabric.js objects
  async applyFabricObjects(
    projectId: string,
    fabricObjects: any[],
  ): Promise<void> {
    const doc = await this.getDocument(projectId);
    const objectsMap = doc.getMap('objects');

    doc.transact(() => {
      // Convert fabric.js objects to serializable format
      fabricObjects.forEach((obj) => {
        // Remove circular references and non-serializable parts
        const serialized = this.sanitizeFabricObject(obj);
        objectsMap.set(
          obj.id ||
            `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          serialized,
        );
      });
    });
  }
  // 4. Apply fabric canvas properties
  async applyCanvasSettings(
    projectId: string,
    canvasSettings: any,
  ): Promise<void> {
    const doc = await this.getDocument(projectId);
    const canvasMap = doc.getMap('canvas');

    doc.transact(() => {
      Object.entries(canvasSettings).forEach(([key, value]) => {
        canvasMap.set(key, value);
      });
    });
  }

  // 5. Handle object manipulations (move, rotate, scale, etc.)
  async updateFabricObject(
    projectId: string,
    objectId: string,
    properties: any,
  ): Promise<void> {
    const doc = await this.getDocument(projectId);
    const objectsMap = doc.getMap('objects');

    doc.transact(() => {
      const existing = objectsMap.get(objectId);
      if (existing) {
        objectsMap.set(objectId, { ...existing, ...properties });
      }
    });
  }
  // 6. Delete objects
  async deleteFabricObjects(
    projectId: string,
    objectIds: string[],
  ): Promise<void> {
    const doc = await this.getDocument(projectId);
    const objectsMap = doc.getMap('objects');

    doc.transact(() => {
      objectIds.forEach((id) => {
        objectsMap.delete(id);
      });
    });
  }

  // 7. Subscribe to document updates
  subscribeToUpdates(
    projectId: string,
    callback: (update: Uint8Array, origin: any) => void,
  ): () => void {
    const doc = this.documents.get(projectId);
    if (!doc) {
      throw new Error(`Document not found for project: ${projectId}`);
    }

    // Set up update listener
    doc.on('update', callback);

    // Return unsubscribe function
    return () => {
      doc.off('update', callback);
    };
  }

  // 8. Integrate with Socket.IO
  setupSocketIntegration(
    projectId: string,
    socket: Socket,
    server: Server,
  ): void {
    const doc = this.documents.get(projectId);
    if (!doc) {
      throw new Error(`Document not found for project: ${projectId}`);
    }

    // Handle incoming updates
    socket.on('drawing:update', (update: Uint8Array) => {
      Y.applyUpdate(doc, update);

      // Broadcast to other clients in the same room
      socket.to(`project:${projectId}`).emit('drawing:update', update);

      // Save state to MongoDB periodically (throttled)
      this.throttledSaveToMongoDB(projectId, doc);
    });

    // Send current document state
    const currentState = Y.encodeStateAsUpdate(doc);
    socket.emit('drawing:initial-state', currentState);

    // Join project room
    socket.join(`project:${projectId}`);
  }

  // 9. Get complete document state
  getDocumentState(projectId: string): Uint8Array {
    const doc = this.documents.get(projectId);
    if (!doc) {
      throw new Error(`Document not found for project: ${projectId}`);
    }
    return Y.encodeStateAsUpdate(doc);
  }

  // 10. Save to MongoDB for long-term persistence
  async saveToMongoDB(projectId: string, doc: Y.Doc): Promise<void> {
    try {
      // Encode the entire document
      const encodedState = Y.encodeStateAsUpdate(doc);

      // For very large documents, we need to chunk the data
      const chunks = this.chunkBinaryData(encodedState);

      // Save metadata from the doc
      const metadata = doc.getMap('metadata').toJSON();

      // Update or create project in MongoDB
      
      await this.drawingModel.findOneAndUpdate(
        { _id: projectId },
        {
          $set: {
            metadata,
            stateChunks: chunks,
            lastUpdated: new Date(),
            chunkCount: chunks.length,
          },
        },
        { upsert: true, new: true },
      );

      this.logger.log(
        `Saved project ${projectId} to MongoDB, ${chunks.length} chunks`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save project ${projectId} to MongoDB: ${error.message}`,
      );
      throw error;
    }
  }

  // 11. Load from MongoDB
  async loadFromMongoDB(projectId: string, doc: Y.Doc): Promise<void> {
    try {
      const project = await this.drawingModel.findById(projectId);

      if (
        !project ||
        !project.stateChunks ||
        project.stateChunks.length === 0
      ) {
        this.logger.log(`No existing state found for project ${projectId}`);
        return;
      }

      // Reconstruct binary data from chunks
      const state = this.reconstructFromChunks(project.stateChunks);

      // Apply to document
      Y.applyUpdate(doc, state);

      this.logger.log(
        `Loaded project ${projectId} from MongoDB (${project.stateChunks.length} chunks)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load project ${projectId} from MongoDB: ${error.message}`,
      );
      throw error;
    }
  }

  // 12. Create snapshot (point-in-time version)
  async createSnapshot(
    projectId: string,
    name: string,
    description?: string,
  ): Promise<string> {
    const doc = await this.getDocument(projectId);
    const state = Y.encodeStateAsUpdate(doc);

    // Generate snapshot ID
    const snapshotId = `${projectId}_${Date.now()}`;

    // Create chunks for state
    const chunks = this.chunkBinaryData(state);

    // Create snapshot document
    await this.drawingModel.create({
      _id: snapshotId,
      originalProject: projectId,
      name,
      description,
      stateChunks: chunks,
      isSnapshot: true,
      createdAt: new Date(),
      chunkCount: chunks.length,
    });

    return snapshotId;
  }

  // 13. Fork project from snapshot
  async forkFromSnapshot(
    snapshotId: string,
    newProjectId: string,
  ): Promise<void> {
    const snapshot = await this.drawingModel.findById(snapshotId);

    if (!snapshot || !snapshot.isSnapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    // Create new project from snapshot
    await this.drawingModel.create({
      creator: snapshot.creator,
      _id: newProjectId,
      originalProject: snapshot.originalProject,
      forkedFrom: snapshotId,
      stateChunks: snapshot.stateChunks,
      chunkCount: snapshot.chunkCount,
      createdAt: new Date(),
    });

    // Now load the document
    const doc = new Y.Doc();
    this.documents.set(newProjectId, doc);

    // Set up Redis persistence
    const persistence = new RedisPersistence({
      redisOpts: {
        host: this.redisConfig.host || 'localhost',
        port: this.redisConfig.port || 6379,
      },
      docName: `drawing:${newProjectId}`,
      document: doc,
    });

    this.persistence.set(newProjectId, persistence);

    // Apply state
    const state = this.reconstructFromChunks(snapshot.stateChunks);
    Y.applyUpdate(doc, state);
  }

  // 14. Export to fabric.js compatible format
  async exportToFabric(projectId: string): Promise<any> {
    const doc = await this.getDocument(projectId);

    // Get canvas settings
    const canvasSettings = doc.getMap('canvas').toJSON();

    // Get all objects
    const objectsMap = doc.getMap('objects');
    const objects = Array.from(objectsMap.entries()).map(([id, obj]: [any, any]) => ({
      id,
      ...obj,
    }));

    return {
      canvas: canvasSettings,
      objects,
    };
  }

  // Helper methods
  private throttledSaveToMongoDB = (() => {
    const pending = new Set<string>();
    let timeout: NodeJS.Timeout | null = null;

    const processPending = async () => {
      const toProcess = Array.from(pending);
      pending.clear();
      timeout = null;

      for (const projectId of toProcess) {
        const doc = this.documents.get(projectId);
        if (doc) {
          await this.saveToMongoDB(projectId, doc).catch((err) => {
            this.logger.error(
              `Failed to save project ${projectId}: ${err.message}`,
            );
          });
        }
      }
    };

    return (projectId: string, doc: Y.Doc) => {
      pending.add(projectId);

      if (!timeout) {
        timeout = setTimeout(processPending, 10000); // Save every 10 seconds at most
      }
    };
  })();

  private sanitizeFabricObject(obj: any): any {
    // Clone to avoid modifying original
    const clone = { ...obj };

    // If it's a fabric.js serialized object, it should already be JSON-safe
    // But we sanitize known problematic properties just in case
    delete clone.canvas;
    delete clone.group;
    delete clone.__corner;

    // Remove functions
    Object.keys(clone).forEach((key) => {
      if (typeof clone[key] === 'function') {
        delete clone[key];
      }
    });

    return clone;
  }

  private chunkBinaryData(
    data: Uint8Array,
    chunkSize = 1024 * 1024,
  ): Uint8Array[] {
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    return chunks;
  }

  private reconstructFromChunks(chunks: Uint8Array[]): Uint8Array {
    // Calculate total length
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);

    // Create new array
    const result = new Uint8Array(totalLength);

    // Copy chunks
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  // Clean up resources
  async cleanUp(projectId: string): Promise<void> {
    // Save state before cleanup
    const doc = this.documents.get(projectId);
    if (doc) {
      await this.saveToMongoDB(projectId, doc);
    }

    // Clean up Redis persistence
    const persistenceInstance = this.persistence.get(projectId);
    if (persistenceInstance) {
      persistenceInstance.destroy();
      this.persistence.delete(projectId);
    }

    // Clean up document
    if (doc) {
      doc.destroy();
      this.documents.delete(projectId);
    }

    this.logger.log(`Cleaned up resources for project ${projectId}`);
  }
}

@Injectable()
export class DrawingService {
  constructor(
    private readonly conversationService: ConversationService,
    @InjectModel(Project.name) private drawingModel: Model<Project>,
  ) {}

  async loadFromMongoDB(projectId: string, doc: Y.Doc) {}
  async create(title, description, creator) {
    const createData = {
      title,
      description,
      creator: creator._id,
      artists: [creator._id],
    };
    const drawing = await this.drawingModel.create(createData);
    if (!drawing) throw new BaseError('Error creating drawing');
    const newConversation = await this.conversationService.create({
      name: title,
      creator: creator._id,
      isGroup: true,
    });
    drawing.conversation = newConversation._id;
    await drawing.save();
    return drawing;
  }

  async findAll({
    filters = {},
    page = 1,
    limit = 10,
    order = -1,
    sortField = 'email',
  }: {
    filters: FilterQuery<Project>;
    page: number;
    limit: number;
    order: SortOrder;
    sortField: string;
  }): Promise<PaginatedDocs<Project>> {
    const fieldsToExclude = ['-__v'];
    return await paginate(
      this.drawingModel,
      filters,
      { page, limit, sortField, sortOrder: order },
      fieldsToExclude,
    );
  }

  async findOne(id?: Types.ObjectId, fields: any = {}) {
    if (id) fields._id = id;
    const drawing = await this.drawingModel.findOne(fields);
    if (!drawing) throw new BaseError('Drawing not found');
    return drawing;
  }

  async update(id: Types.ObjectId, title?: string, description?: string) {
    const drawing = await this.findOne(id);
    if (title) drawing.title = title;
    if (description) drawing.description = description;
    await drawing.save();
    return drawing;
  }

  async remove(id: Types.ObjectId) {
    const drawing = await this.findOne(id);
    if (drawing.artists.length > 1)
      throw new ForbiddenError('Drawing has more than one artist');
    await drawing.remove();
    return drawing;
  }

  async addArtist(drawingId: Types.ObjectId, artistId: Types.ObjectId) {
    const drawing = await this.findOne(drawingId);
    drawing.artists.push(artistId);
    if (drawing.artists.some((member) => member.equals(artistId))) {
      throw new ValidationError(
        'User is already a member of this conversation',
      );
    }
    if (drawing.artists.length >= CONVERSATION_MAX_MEMBERS) {
      throw new ValidationError(
        'Conversation has reached the maximum number of members',
      );
    }
    drawing.artists.push(artistId);
    await this.conversationService.addMember(drawing.conversation, artistId);
    await drawing.save();
    return drawing;
  }

  async removeArtist(drawingId: Types.ObjectId, artistId: Types.ObjectId) {
    const drawing = await this.findOne(drawingId);
    drawing.artists = drawing.artists.filter((id) => !id.equals(artistId));
    await this.conversationService.removeMember(drawing.conversation, artistId);
    await drawing.save();
  }
}
