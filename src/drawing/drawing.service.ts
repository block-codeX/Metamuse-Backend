import { Injectable } from '@nestjs/common';
import { CreateDrawingDto } from './dto/create-drawing.dto';
import { UpdateDrawingDto } from './dto/update-drawing.dto';
import * as Y from 'yjs';
import { Redis } from 'ioredis';
import { RedisProvider } from 'y-redis';
import { ConversationService } from 'src/conversation/conversation.service';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Drawing } from './drawing.schema';
import BaseError, {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@app/utils/utils.errors';
import { CONVERSATION_MAX_MEMBERS, PaginatedDocs, paginate } from '@app/utils';
import { UsersService } from 'src/users/users.service';
@Injectable()
export class SharedService {
  private redis: Redis;
  private yRedis: RedisProvider;

  constructor() {
    this.redis = new Redis();
    this.yRedis = new RedisProvider({ redis: this.redis });
  }

  createDrawing(roomid: Types.ObjectId): Y.Doc {
    const doc = new Y.Doc();
    this.yRedis.on('documentLoaded', (doc) => {
      console.log(`Document ${roomId} loaded`);
    });
    this.yRedis.on('update', (update, origin) => {
      Y.applyUpdate(doc, update, origin);
    });
    return doc;
  }

  getDocumentUpdates(doc: Y.Doc): Uint8Array {
    return Y.encodeStateAsUpdate(doc);
  }

  applyUpdate(doc: Y.Doc, update: Uint8Array, origin: any) {
    Y.applyUpdate(doc, update, origin);
  }
  create(createDrawingDto: CreateDrawingDto) {
    return 'This action adds a new drawing';
  }

  findAll() {
    return `This action returns all drawing`;
  }

  findOne(id: number) {
    return `This action returns a #${id} drawing`;
  }

  update(id: number, updateDrawingDto: UpdateDrawingDto) {
    return `This action updates a #${id} drawing`;
  }

  remove(id: number) {
    return `This action removes a #${id} drawing`;
  }
}

@Injectable()
export class DrawingService {
  constructor(
    private readonly conversationService: ConversationService,
    @InjectModel(Drawing.name) private drawingModel: Model<Drawing>,
  ) {}
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
    filters: FilterQuery<Drawing>;
    page: number;
    limit: number;
    order: SortOrder;
    sortField: string;
  }): Promise<PaginatedDocs<Drawing>> {
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
