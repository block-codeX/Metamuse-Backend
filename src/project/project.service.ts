import { ConsoleLogger, Injectable } from '@nestjs/common';
import { ConversationService } from 'src/conversation/conversation.service';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import {
  CollaborationRequest,
  Project,
  ProjectDocument,
} from './project.schema';
import BaseError, {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@app/utils/utils.errors';
import { CONVERSATION_MAX_MEMBERS, PaginatedDocs, paginate } from '@app/utils';
import { CreateProjectDto } from './project.dto';
import { OTPService } from 'src/auth/auth.service';
import { encryptObjectId } from '@app/utils/utils.encrypt';
/**
 * File service, makes use of gridfs for now, would switch to aws or another thing while upscaling...
 */

@Injectable()
export class ProjectService {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly otpService: OTPService,
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(CollaborationRequest.name)
    private requestModel: Model<CollaborationRequest>,
  ) {}
  private readonly logger = new ConsoleLogger(ProjectService.name);

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

  async findCollaborationRequests({
    filters = {},
    page = 1,
    limit = 10,
    order = -1,
    sortField = '-createdAt',
  }: {
    filters: FilterQuery<CollaborationRequest>;
    page: number;
    limit: number;
    order: SortOrder;
    sortField: string;
  }): Promise<PaginatedDocs<CollaborationRequest>> {
    const fieldsToExclude = ['-__v'];
    const populateFields = [
      {
        path: 'collaborator',
        select: ['-__v', '-password', '-lastAuthChange'],
      },
      { path: 'project', select: ['-__v'] },
    ];

    return await paginate(
      this.requestModel,
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
    const request = await this.requestModel.findOne({
      project: projectId,
      collaborator: collaboratorId,
    });
    if (!request) {
      throw new ValidationError('User has not been invited to this project');
    }
    const project = await this.findOne(projectId);
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
    await request.deleteOne()
    await project.save();
    return project;
  }

  async inviteCollaborator(
    projectId: Types.ObjectId,
    collaboratorId: Types.ObjectId,
  ) {
    const project: any = await this.findOne(projectId);
    if (project.collaborators.some((member) => member.equals(collaboratorId))) {
      throw new ValidationError('User is already a member of this project');
    }
    if (project.collaborators.length >= CONVERSATION_MAX_MEMBERS) {
      throw new ValidationError(
        'Project has reached the maximum number of members',
      );
    }
    if (
      await this.requestModel.findOne({
        project: projectId,
        collaborator: collaboratorId,
      })
    ) {
      throw new ValidationError(
        'User has already been invited to this project',
      );
    }
    const inviteToken = await this.otpService.newToken(
      project._id,
      collaboratorId,
    );
    const token = encryptObjectId(inviteToken._id.toString());
    await this.requestModel.create({
      project: projectId,
      collaborator: collaboratorId,
      token,
    });
    return [token, project];
  }
  async findPendingInvites({
    filters = {},
    page = 1,
    limit = 10,
    order = -1,
    sortField = '-createdAt',
  }: {
    filters: FilterQuery<CollaborationRequest>;
    page: number;
    limit: number;
    order: SortOrder;
    sortField: string;
  }): Promise<PaginatedDocs<CollaborationRequest>> {
    const fieldsToExclude = ['-__v'];
    const populateFields = [
      {
        path: 'collaborator',
        select: ['-__v', '-password', '-lastAuthChange'],
      },
      { path: 'project', select: ['-__v'] },
    ];
    return await paginate(
      this.requestModel,
      { ...filters, token: { $exists: true } },
      { page, limit, sortField, sortOrder: order },
      fieldsToExclude,
      populateFields as any,
    );
  }

  async cancelCollaborationRequest(
    projectId: Types.ObjectId,
    collaboratorId: Types.ObjectId,
  ) {
    const collaborationRequest = await this.requestModel.findOne({
      project: projectId,
      collaborator: collaboratorId,
    });
    if (!collaborationRequest)
      throw new NotFoundError('Collaboration request not found');
    await collaborationRequest.deleteOne();
    return collaborationRequest;
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
