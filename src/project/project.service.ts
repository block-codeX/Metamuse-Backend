import { ConsoleLogger, Inject, Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { Server, Socket } from 'socket.io';
import { RedisPersistence, PersistenceDoc } from 'y-redis';
import { ConversationService } from 'src/conversation/conversation.service';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Project, ProjectDocument } from './project.schema';
import BaseError, {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@app/utils/utils.errors';
import {
  CONVERSATION_MAX_MEMBERS,
  DB_CONNECTION_STRING,
  DB_NAME,
  PaginatedDocs,
  paginate,
} from '@app/utils';
import { MongoClient, GridFSBucket, GridFSFile, Filter } from 'mongodb';
import { Readable } from 'stream';
import { CreateProjectDto } from './project.dto';
import { UsersService } from 'src/users/users.service';
import * as fabric from 'fabric';
/**
 * File service, makes use of gridfs for now, would switch to aws or another thing while upscaling...
 */
@Injectable()
export class FileService {
  private client: MongoClient;
  private bucket: GridFSBucket;
  constructor() {
    this.client = new MongoClient(DB_CONNECTION_STRING);
    this.client.connect().then(() => {
      const db = this.client.db(DB_NAME);
      this.bucket = new GridFSBucket(db);
    });
  }
  async saveFile(stream: Readable, filename: string): Promise<string> {
    const uploadStream = this.bucket.openUploadStream(filename);
    stream.pipe(uploadStream);

    return new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id.toString()));
      uploadStream.on('error', reject);
    });
  }
  async findFiles(filters: Filter<GridFSFile>): Promise<any[]> {
    return this.bucket.find(filters).toArray();
  }
  async findOne(fileId: Types.ObjectId): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const downloadStream = this.bucket.openDownloadStream(fileId);

    return new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
      downloadStream.on('error', reject);
    });
  }

  async returnFile(doc: Y.Doc) {
    const objects = doc.getMap('objects').toJSON();
    const canvas = doc.getMap('canvas').toJSON();
    return { objects, canvas };
  }

  async deleteFile(fileId: Types.ObjectId): Promise<void> {
    await this.bucket.delete(fileId);
  }
}

@Injectable()
export class ProjectService {
  constructor(
    private readonly conversationService: ConversationService,
    private fileService: FileService,
    @InjectModel(Project.name) private projectModel: Model<Project>,
  ) {}
  private readonly logger = new ConsoleLogger(ProjectService.name);

  async loadFromMongoDB(projectId: Types.ObjectId, doc: Y.Doc): Promise<any> {
    const project = await this.findOne(projectId);
    if (!project.gridFsId) {
      // Save initial state if none exists
      const update = Y.encodeStateAsUpdate(doc);
      const updateBuffer = Buffer.from(update);
      const stream = new Readable();
      stream.push(updateBuffer);
      stream.push(null);
      const gridFsId = await this.fileService.saveFile(stream, `project-${projectId}-state`);
      project.gridFsId = gridFsId.toString();
      await project.save();
    }
    this.logger.log("GridFS file ID:", project.gridFsId);
    const buffer = await this.fileService.findOne(new Types.ObjectId(project.gridFsId));
    this.logger.log(`Loaded update with length: ${buffer.length}`);
    // Ensure it's a Uint8Array
   const value =  new Uint8Array(buffer);
    Y.applyUpdate(doc, value);
    return value;
  }
  
  async create(data: CreateProjectDto) {
    const {
      title,
      description,
      creator,
      isForked = false,
      forkedFrom = null,
      tags = [],
    } = data;
    const newConversation = await this.conversationService.create({
      name: title,
      creator: creator._id,
      isGroup: true,
    });
    const createData = {
      title,
      description,
      isForked,
      forkedFrom,
      creator: creator._id,
      collaborators: [creator._id],
      conversation: newConversation._id,
      tags,
    };
    const project = await this.projectModel.create(createData);
    if (!project) throw new BaseError('Error creating project');
    await project.save();
    return project;
  }

  async findAll({
    filters = {},
    page = 1,
    limit = 10,
    order = -1,
    sortField = '-createdAt',
    full = false,
  }: {
    filters: FilterQuery<Project>;
    full: boolean;
    page: number;
    limit: number;
    order: SortOrder;
    sortField: string;
  }): Promise<PaginatedDocs<Project>> {
    const fieldsToExclude = ['-__v'];
    const populateFields = [
      { path: 'creator', select: ['-__v', '-password', '-lastAuthChange'] },
    ];
    if (full)
      populateFields.push({
        path: 'collaborators',
        select: ['-__v', '-password', '-lastAuthChange'],
      });
    return await paginate(
      this.projectModel,
      filters,
      { page, limit, sortField, sortOrder: order },
      fieldsToExclude,
      populateFields as any,
    );
  }

  async findOne(
    id?: Types.ObjectId,
    fields: any = {},
    full = false,
  ): Promise<ProjectDocument> {
    if (id) fields._id = id;
    const project = await this.projectModel.findOne(fields);
    if (!project) throw new NotFoundError('Project not found');
    if (full) {
      await project.populate({
        path: 'creator collaborators',
        select: '-password -lastAuthChange',
      });
    }
    return project;
  }

  async findSnapshots(
    projectId: Types.ObjectId,
    user?: string,
  ): Promise<any[]> {
    let regex = `snapshot-${projectId}`;
    if (user) regex += `-${user}`;

    const project = await this.findOne(projectId);
    const snapshots = await this.fileService.findFiles({
      filename: { $regex: regex },
    });
    return snapshots.map((snapshot) => ({
      name: snapshot.filename,
      id: snapshot._id.toString(),
    }));
  }
  async update(id: Types.ObjectId, title?: string, description?: string) {
    const project = await this.findOne(id);
    if (title) project.title = title;
    if (description) project.description = description;
    await project.save();
    return project;
  }

  async remove(id: Types.ObjectId) {
    const project = await this.findOne(id);
    if (project.collaborators.length > 1)
      throw new ForbiddenError('project has more than one artist');
    await project.deleteOne();
    return project;
  }

  async addCollaborator(
    projectId: Types.ObjectId,
    collaboratorId: Types.ObjectId,
  ) {
    const project = await this.findOne(projectId);
    project.collaborators.push(collaboratorId);
    if (project.collaborators.some((member) => member.equals(collaboratorId))) {
      throw new ValidationError(
        'User is already a member of this conversation',
      );
    }
    if (project.collaborators.length >= CONVERSATION_MAX_MEMBERS) {
      throw new ValidationError(
        'Conversation has reached the maximum number of members',
      );
    }
    project.collaborators.push(collaboratorId);
    await this.conversationService.addMember(
      project.conversation,
      collaboratorId,
    );
    await project.save();
    return project;
  }

  async removeCollaborator(
    projectId: Types.ObjectId,
    collaboratorId: Types.ObjectId,
  ) {
    const project = await this.findOne(projectId);
    project.collaborators = project.collaborators.filter(
      (id) => !id.equals(collaboratorId),
    );
    await this.conversationService.removeMember(
      project.conversation,
      collaboratorId,
    );
    await project.save();
  }
}

@Injectable()
export class CRDTService {
  private readonly logger = new ConsoleLogger(CRDTService.name);
  private documents = new Map<string, Y.Doc>();
  private persistence = new Map<string, PersistenceDoc>();

  constructor(
    private readonly projectService: ProjectService,
    private readonly fileService: FileService,
    private readonly userService: UsersService,
    @Inject('REDIS_CONFIG') private readonly redisConfig: any,
    @InjectModel(Project.name) private projectModel: Model<Project>,
  ) {}

  async getDocument(projectId: string, existingDoc: Y.Doc | null = null): Promise<any> {
    const doc = await this.createDocument(projectId, existingDoc);
    return doc;
  }

  async createDocument(projectId: string, existingDoc: Y.Doc | null): Promise<any> {
    // return new Promise(async (resolve) => {
    existingDoc = existingDoc || new Y.Doc();
    existingDoc.getMap('metadata').set('projectId', projectId);
    // Load data from MongoDB
    const result = await this.projectService.loadFromMongoDB(
      new Types.ObjectId(projectId),
      existingDoc,
    );
    return result;
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
    socket.on('project:update', (update: Uint8Array) => {
      Y.applyUpdate(doc, update);

      // Broadcast to other clients in the same room
      socket.to(`project:${projectId}`).emit('project:update', update);

      // Save state to MongoDB periodically (throttled)
      this.throttledSaveToMongoDB(projectId, doc);
    });

    // Send current document state
    const currentState = Y.encodeStateAsUpdate(doc);
    socket.emit('project:initial-state', currentState);

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

  // 13. Fork project from snapshot
  async forkProject(
    projectId: string,
    forker: string,
  ): Promise<ProjectDocument> {
    const projId = new Types.ObjectId(projectId);
    const originalProject = await this.projectService.findOne(projId);
    const userWhoForked = await this.userService.findOne(
      new Types.ObjectId(forker),
    );
    if (!originalProject) throw new NotFoundError('Original project not found');
    const buffer = await this.fileService.findOne(
      new Types.ObjectId(originalProject.gridFsId),
    );
    const update = new Uint8Array(buffer);
    const newDoc = new Y.Doc();
    Y.applyUpdate(newDoc, update);
    const stream = new Readable();
    stream.push(update);
    stream.push(null); // Signal end of stream
    const gridFsId = await this.fileService.saveFile(
      stream,
      `forked-project-${projectId}-${Date.now()}`,
    );
    const forkedProject = await this.projectService.create({
      title: `Fork of ${originalProject.title}`,
      description: originalProject.description,
      creator: userWhoForked._id,
      isForked: true,
      forkedFrom: projId,
      tags: originalProject.tags,
    });

    // Update the forked project with the new GridFS file ID
    forkedProject.gridFsId = gridFsId;
    await forkedProject.save();
    return forkedProject;
  }
  async createSnapshot(projectId: string, user?: string): Promise<string> {
    let regex = `snapshot-${projectId}`;
    if (user) regex += `-${user}`;
    const doc = this.documents.get(projectId);
    if (!doc) throw new NotFoundError('Document not found');

    // Serialize the Yjs document state
    const update = Y.encodeStateAsUpdate(doc);
    const stream = new Readable();
    stream.push(update);
    stream.push(null); // Signal end of stream
    return this.fileService.saveFile(stream, `${regex}-${Date.now()}`);
  }
  // 14. Export to fabric.js compatible format
  async exportToFabric(projectId: string): Promise<any> {
    const doc = await this.getDocument(projectId);

    // Get canvas settings
    const canvasSettings = doc.getMap('canvas').toJSON();

    // Get all objects
    const objectsMap = doc.getMap('objects');
    const objects = Array.from(objectsMap.entries()).map(
      ([id, obj]: [any, any]) => ({
        id,
        ...obj,
      }),
    );

    return {
      canvas: canvasSettings,
      objects,
    };
  }

  // Helper methods
  throttledSaveToMongoDB = (() => {
    const pending = new Set<string>();
    let timeout: NodeJS.Timeout | null = null;

    const MAX_BATCH_SIZE = 50; // Maximum number of pending saves to process at once

    const processPending = async () => {
      const toProcess = Array.from(pending).slice(0, MAX_BATCH_SIZE);
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

  async saveToMongoDB(projectId: string, doc: Y.Doc): Promise<void> {
    const project = await this.projectService.findOne(new Types.ObjectId(projectId));
    if (!project) throw new Error('Project not found');
  
    const update = Y.encodeStateAsUpdate(doc);
    const updateBuffer = Buffer.from(update); // Convert to Buffer
    this.logger.log(`Saving update with length: ${updateBuffer.length}`);
    
    const stream = new Readable();
    stream.push(updateBuffer);
    stream.push(null);
  
    const gridFsId = await this.fileService.saveFile(stream, `project-${projectId}-state`);
    project.gridFsId = gridFsId;
    await project.save();
    this.logger.log(`Saved project state to MongoDB for project ${projectId}`);
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
