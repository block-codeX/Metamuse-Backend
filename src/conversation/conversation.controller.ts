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
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ForbiddenError, NotFoundError, ValidationError } from '@app/utils';
import { Types } from 'mongoose';
import { IsConversationCreator } from './conversation.permission';
import AuthPermissions from '@app/utils/utils.permission';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

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
  findAll() {
    return this.conversationService.findAll();
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
}
