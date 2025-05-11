import { Injectable } from '@nestjs/common';
import {
  CreateMessagingDto,
  ICreateConversation,
  UpdateMessagingDto,
} from './conversation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Conversation, Message } from './conversation.schema';
import {
  CONVERSATION_MAX_MEMBERS,
  NotFoundError,
  paginate,
  PaginatedDocs,
  ValidationError,
} from '@app/utils';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly userService: UsersService,
  ) {}
  async create(data: ICreateConversation) {
    const { name, isGroup = false, creator, members = [], admins = [] } = data;
    const input_data = {};
    if (isGroup && !name) {
      throw new ValidationError('Every group must have a name');
    }
    admins.push(creator);
    members.push(creator);
    if (isGroup) {
      input_data['admins'] = admins;
    }
    input_data['name'] = name;
    input_data['isGroup'] = isGroup;
    input_data['creator'] = creator;
    input_data['members'] = members;
    return await this.conversationModel.create(input_data);
  }

  async converse(first: Types.ObjectId, second: Types.ObjectId) {
    const conversation = await this.conversationModel.findOne({
      members: { $all: [first, second] }, isGroup: false
    });
    if (conversation) return conversation;
    const conv = await this.create({
      creator: first,
      isGroup: false,
      members: [second],
    });
    return conv;
  }

  async findAll({
    filters = {},
    page = 1,
    limit = 10,
    order = -1,
    sortField = 'updatedAt',
    currentUserId,
  }: {
    filters: FilterQuery<Conversation>;
    page: number;
    limit: number;
    order: SortOrder;
    sortField: string;
    currentUserId: string;
  }): Promise<
    PaginatedDocs<Conversation & { displayName?: string; unreadCount: number }>
  > {
    const fieldsToExclude = ['-__v'];
    const populateFields = [
      { path: 'lastMessage', select: ['-__v'] },
      { path: 'members', select: ['-__v', '-password', '-lastAuthChange'] },
    ];

    const paginatedResult = await paginate(
      this.conversationModel,
      filters,
      { page, limit, sortField, sortOrder: order },
      fieldsToExclude,
      populateFields,
    );

    const conversationIds = paginatedResult.docs.map((conv) => conv._id);

    // One MongoDB aggregate to fetch unread counts
    const unreadCounts = await this.messageModel.aggregate([
      {
        $match: {
          conversation: { $in: conversationIds },
          readBy: { $ne: new Types.ObjectId(currentUserId) },
        },
      },
      {
        $group: {
          _id: '$conversation',
          unreadCount: { $sum: 1 },
        },
      },
    ]);

    // Build a lookup map: { conversationId: unreadCount }
    const unreadCountMap: Record<string, number> = {};
    unreadCounts.forEach((item) => {
      unreadCountMap[item._id.toString()] = item.unreadCount;
    });

    const updatedDocs = paginatedResult.docs.map((conversation) => {
      let displayName: string | undefined = undefined;
      if (!conversation.isGroup && conversation.members) {  
        const otherUser = conversation.members.find(
          (m: any) => m._id.toString() !== currentUserId,
        );
        conversation.name = `${otherUser?.firstName} ${otherUser?.lastName}` || 'Unknown';
      }
      const unreadCount = unreadCountMap[conversation._id.toString()] || 0;
      return {
        ...conversation.toObject(),
        unreadCount,
      };
    });

    return {
      ...paginatedResult,
      docs: updatedDocs,
    };
  }
  async findOne(id: Types.ObjectId) {
    const conversation = await this.conversationModel.findById(id);
    if (conversation == null) throw new NotFoundError('Conversation not found');
    return conversation;
  }

  update(id: number, updateMessagingDto: UpdateMessagingDto) {
    return `This action updates a #${id} messaging`;
  }

  async remove(id: Types.ObjectId) {
    const conversation = await this.conversationModel.findOneAndDelete({
      _id: id,
    });
    if (conversation == null) throw new NotFoundError('User not found');
    return conversation;
  }

  async addMember(conversationId: Types.ObjectId, memberId: Types.ObjectId) {
    const user = await this.userService.findOne(memberId);
    const conversation = await this.findOne(conversationId);
    if (conversation.members.some((member) => member.equals(memberId))) {
      throw new ValidationError(
        'User is already a member of this conversation',
      );
    }
    if (conversation.members.length >= CONVERSATION_MAX_MEMBERS) {
      throw new ValidationError(
        'Conversation has reached the maximum number of members',
      );
    }
    conversation.members.push(memberId);
    await conversation.save();
    await conversation.populate('members', '_id email firstName lastName');
    await conversation.populate('admins', '_id email firstName lastName');
    return conversation;
  }
  async removeMember(conversationId: Types.ObjectId, memberId: Types.ObjectId) {
    const conversation = await this.findOne(conversationId);
    if (!conversation.members.includes(memberId)) {
      throw new ValidationError('User is not a member of this conversation');
    }
    await this.userService.findOne(memberId);
    conversation.members = conversation.members.filter(
      (id) => !id.equals(memberId),
    );
    await conversation.save();
    return conversation;
  }

  async markAllAsSeen(conversationId: Types.ObjectId, userId: Types.ObjectId) {
    await this.messageModel.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $push: { readBy: userId } },
    );
  }
  async addAdmin(conversationId: Types.ObjectId, adminId: Types.ObjectId) {
    const conversation = await this.findOne(conversationId);
    if (!conversation.isGroup) {
      throw new ValidationError('Only group conversations can have admins');
    }
    if (conversation.admins.includes(adminId)) {
      throw new ValidationError(
        'User is already an admin of this conversation',
      );
    }
    await this.userService.findOne(adminId);
    if (!conversation.members.some((member) => member.equals(adminId)))
      throw new ValidationError(
        'User must be a member of the conversation to be an admin',
      );

    conversation.admins.push(adminId);
    await conversation.save();
    return conversation;
  }
  async removeAdmin(conversationId: Types.ObjectId, adminId: Types.ObjectId) {
    const conversation = await this.findOne(conversationId);
    if (!conversation.isGroup) {
      throw new ValidationError('Only group conversations can have admins');
    }
    if (!conversation.admins.some((admin) => admin.equals(adminId))) {
      throw new ValidationError('User is not an admin of this conversation');
    }
    conversation.admins = conversation.admins.filter(
      (id) => !id.equals(adminId),
    );
    await conversation.save();
    return conversation;
  }
}

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly conversationService: ConversationService,
    private readonly userService: UsersService,
  ) {}
  async create(createMessagingDto: CreateMessagingDto): Promise<Message> {
    await this.conversationService.findOne(createMessagingDto.conversation);
    await this.userService.findOne(createMessagingDto.sender);
    const message = await this.messageModel.create(createMessagingDto);
    return message;
  }
  // When a user reads a message
  async markMessageAsRead(messageId: Types.ObjectId, userId: Types.ObjectId) {
    const toggledMessage = await this.messageModel.updateOne(
      { _id: messageId, readBy: { $ne: userId } }, // only if they haven't read it yet
      { $push: { readBy: userId } },
    );
    return toggledMessage;
  }

  async findAll({
    filters = {},
    page = 1,
    limit = 10,
    order = -1,
    sortField = '-createdAt',
    full = false,
  }: {
    filters: FilterQuery<Message>;
    page: number;
    full: boolean;
    limit: number;
    order: SortOrder;
    sortField: string;
  }): Promise<PaginatedDocs<Message>> {
    const fieldsToExclude = ['-__v', '-isRead'];
    const populateFields: any = [];
    if (full)
      populateFields.push({
        path: 'sender',
        select: ['-__v', '-password', '-lastAuthChange'],
      });
    return await paginate(
      this.messageModel,
      filters,
      { page, limit, sortField, sortOrder: order },
      fieldsToExclude,
      populateFields as any,
    );
  }
  async findOne(id: Types.ObjectId) {
    const message = await this.messageModel.findById(id);
    if (message == null) throw new NotFoundError('Message not found');
    return message;
  }

  async update(id: Types.ObjectId, content: string) {
    const message = await this.findOne(id);
    if (!message) throw new NotFoundError('Message not found');
    message.content = content;
    message.isEdited = true;
    await message.save();
    return message;
  }

  async remove(id: Types.ObjectId) {
    const message = await this.messageModel.findOneAndDelete({ _id: id });
    if (message == null) throw new NotFoundError('Message not found');
    return message;
  }
}
