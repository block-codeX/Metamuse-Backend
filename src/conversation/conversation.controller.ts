import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
  BadRequestException,
  Request,
  Query,
} from '@nestjs/common';
import { ConversationService, MessageService } from './conversation.service';
import {
  ForbiddenError,
  NotFoundError,
  PaginatedQuery,
  ValidationError,
} from '@app/utils';
import { FilterQuery, Types } from 'mongoose';
import {
  IsConversationAdmin,
  IsConversationCreator,
  IsConversationMember,
} from './conversation.permission';
import AuthPermissions from '@app/utils/utils.permission';
import { Message } from './conversation.schema';

interface GetMessagesQuery extends PaginatedQuery {
  text?: string;
}
interface AddMember {
  userId: string;
  isLink: boolean;
}

@Controller('conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  @Post('new')
  async create(@Request() req, @Body() name: string) {
    try {
      const createData = {
        name,
        creator: req.user._id,
        admins: [req.user._id],
        isGroup: true,
      };
      const conversation = await this.conversationService.create(createData);
      await conversation.populate('members', '_id firstName lastName email');
      return conversation;
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }
  @Post('converse')
  async converse(@Body() converseDto: { first: string; second: string }) {
    try {
      const first = Types.ObjectId.createFromHexString(converseDto.first);
      const second = Types.ObjectId.createFromHexString(converseDto.second);
      const conversation = await this.conversationService.converse(
        first,
        second,
      );
      conversation.populate('members');
      return conversation;
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  findAll(@Request() req, @Query() query: PaginatedQuery) {
    try {
      const { page = 1, limit = 100 } = query;
      const filters = { members: { $in: [req.user._id] } };
      return this.conversationService.findAll({
        filters: {},
        page,
        limit,
        order: -1,
        sortField: 'name',
      });
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const conversationId = Types.ObjectId.createFromHexString(id);
      const conversation =
        await this.conversationService.findOne(conversationId);
      await conversation.populate('members', '_id firstName lastName email');
      return conversation;
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() name: string) {
    try {
      const permissions = [new IsConversationCreator()];
      const conversationId = Types.ObjectId.createFromHexString(id);
      const conversation =
        await this.conversationService.findOne(conversationId);
      const { success, error } = AuthPermissions.checkObjPermissions(
        permissions,
        req,
        conversation,
      );
      if (!success && error != null)
        throw new ForbiddenError(error, 403, 'Permission denied');
      conversation.name = name;
      await conversation.save();
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ForbiddenError)
        throw new BadRequestException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    try {
      const permissions = [new IsConversationCreator()];
      const conversationId = Types.ObjectId.createFromHexString(id);
      const conversation =
        await this.conversationService.findOne(conversationId);
      const { success, error } = AuthPermissions.checkObjPermissions(
        permissions,
        req,
        conversation,
      );
      if (!success && error != null)
        throw new ForbiddenError(
          error,
          403,
          "Permission denied, you don't have permission to delete this conversation",
        );
      await this.conversationService.remove(conversationId);
      return { message: 'Conversation successfully deleted' };
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ForbiddenError)
        throw new BadRequestException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }
  @Get(':id/messages/:msgId')
  async findOneMessage(
    @Request() req,
    @Param('id') id: string,
    @Param('msgId') msgId: string,
  ) {
    try {
      const permissions = [new IsConversationMember()];
      const conversationId = Types.ObjectId.createFromHexString(id);
      const messageId = Types.ObjectId.createFromHexString(msgId);
      const conversation =
        await this.conversationService.findOne(conversationId);
      const message = await this.messageService.findOne(messageId);
      const { success, error } = AuthPermissions.checkObjPermissions(
        permissions,
        req,
        conversation,
      );
      if (!success && error != null)
        throw new ForbiddenError(
          error,
          403,
          "Permission denied, you're not a member of this conversation",
        );
      if (message.conversation.toString() != conversationId.toString())
        throw new BadRequestException(
          'This message does not belong to this conversation',
        );
      return message;
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ForbiddenError)
        throw new BadRequestException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }
  @Get(':id/messages')
  async findAllMessages(
    @Request() req,
    @Param('id') id: string,
    @Query() query: GetMessagesQuery,
  ) {
    try {
      const permissions = [new IsConversationMember()];
      const conversationId = Types.ObjectId.createFromHexString(id);
      const conversation =
        await this.conversationService.findOne(conversationId);
      const { success, error } = AuthPermissions.checkObjPermissions(
        permissions,
        req,
        conversation,
      );
      if (!success && error != null)
        throw new ForbiddenError(
          error,
          403,
          "Permission denied, you're not a member of this conversation",
        );
      const filters: FilterQuery<Message> = { conversation: conversationId };
      if (query.text) filters.text = query.text;
      const { page = 1, limit = 1000 } = query;
      const messages = await this.messageService.findAll({
        filters,
        page,
        limit,
        order: -1,
        sortField: 'createdAt',
      });
      return messages;
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ForbiddenError)
        throw new BadRequestException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/admins/new')
  async addAdmin(
    @Request() req,
    @Param('id') id: string,
    @Body() adminId: string,
  ) {
    try {
      const permissions = [new IsConversationAdmin()];
      const conversationId = Types.ObjectId.createFromHexString(id);
      const admin = Types.ObjectId.createFromHexString(adminId);
      const conversation =
        await this.conversationService.findOne(conversationId);
      if (!conversation.isGroup)
        throw new ValidationError('Only group conversations can have admins');
      const { success, error } = AuthPermissions.checkObjPermissions(
        permissions,
        req,
        conversation,
      );
      if (!success && error != null)
        throw new ForbiddenError(
          error,
          403,
          "Permission denied, you're not an admin conversation",
        );
      const updatedConversation = await this.conversationService.addAdmin(
        conversationId,
        admin,
      );
      return updatedConversation;
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ForbiddenError)
        throw new BadRequestException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id/admins/:adminId')
  async removeAdmin(
    @Request() req,
    @Param('id') id: string,
    @Param('adminId') adminId: string,
  ) {
    try {
      const permissions = [new IsConversationCreator()];
      const conversationId = Types.ObjectId.createFromHexString(id);
      const admin = Types.ObjectId.createFromHexString(adminId);
      const conversation =
        await this.conversationService.findOne(conversationId);
      if (!conversation.isGroup)
        throw new ValidationError('Only group conversations can have admins');
      const { success, error } = AuthPermissions.checkObjPermissions(
        permissions,
        req,
        conversation,
      );
      if (!success && error != null)
        throw new ForbiddenError(
          error,
          403,
          "Permission denied, you're not the creator of this conversation",
        );
      const updatedConversation = await this.conversationService.removeAdmin(
        conversationId,
        admin,
      );
      return updatedConversation;
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ForbiddenError)
        throw new BadRequestException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/members/new')
  async addMember(
    @Request() req,
    @Param('id') id: string,
    @Body() data: AddMember,
  ) {
    try {
      const permissions = [new IsConversationMember()];
      const conversationId = Types.ObjectId.createFromHexString(id);
      const member = Types.ObjectId.createFromHexString(data.userId);
      const conversation =
        await this.conversationService.findOne(conversationId);
      const { success, error } = AuthPermissions.checkObjPermissions(
        permissions,
        req,
        conversation,
      );
      if (!success && error != null)
        throw new ForbiddenError(
          error,
          403,
          "Permission denied, you're not a member of this conversation",
        );
      if (!data.isLink) {
        const updatedConversation = await this.conversationService.addMember(
          conversationId,
          member,
        );
        return {
          message: 'Member successfully added',
          conversation: updatedConversation,
        };
      } else {
        // Create a link to send a conversation
        // Send the link to the person's email
        return { message: 'Link successfully created' };
      }
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ForbiddenError)
        throw new BadRequestException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Request() req,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    try {
      const permissions = [new IsConversationAdmin()];
      const conversationId = Types.ObjectId.createFromHexString(id);
      const member = Types.ObjectId.createFromHexString(memberId);
      const conversation =
        await this.conversationService.findOne(conversationId);
      const { success, error } = AuthPermissions.checkObjPermissions(
        permissions,
        req,
        conversation,
      );
      if (!success && error != null)
        throw new ForbiddenError(
          error,
          403,
          "Permission denied, you're not a member of this conversation",
        );
      const updatedConversation = await this.conversationService.removeMember(
        conversationId,
        member,
      );
      return updatedConversation;
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof ForbiddenError)
        throw new BadRequestException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/members/join')
  async joinConversation(@Request() req, @Param('id') id: string) {
    // To be implemented later
  }
}
