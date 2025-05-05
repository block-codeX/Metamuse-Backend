import {
  Body,
  Controller,
  Request,
  UsePipes,
  Post,
  BadRequestException,
  Get,
  Query,
  Param,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import {
  NewProjectDto,
  newProjectSchema,
} from './project.dto';
import { ProjectService } from './project.service';
import { NotFoundError, PaginatedQuery, ZodValidationPipe } from '@app/utils';
import { decryptObjectId } from '@app/utils/utils.encrypt';
import { FilterQuery, Types } from 'mongoose';
import { AllowAny } from 'src/auth/auth.decorator';
import { Project } from './project.schema';
import * as Y from 'yjs';
import { UsersService } from 'src/users/users.service';
import { OTPService } from 'src/auth/auth.service';
import BaseError from '@app/utils/utils.errors';
import { EmailService } from 'src/notification/notification.service';
import { User } from 'src/users/users.schema';
interface GetProjectsQuery extends PaginatedQuery {
  creator?: string;
  isCompleted: string;
  isForked: string;
  tags: string;
  collaborator?: string;
  title?: string;
  full?: string;
}
interface GetUsersQuery {
  name?: string;
  email?: string;
  page?: number;
  limit?: number;
}
@Controller('projects')
export class ProjectController {
  // Create project
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OTPService,
    private readonly projectService: ProjectService,
    private readonly emailService: EmailService,
  ) {}
  @Post('new')
  @UsePipes(new ZodValidationPipe(newProjectSchema))
  async create(@Request() req, @Body() newProjectData: NewProjectDto) {
    try {
      const data: any = { ...newProjectData, creator: req.user._id };
      if (newProjectData.forkedFrom) {
        data.forkedFrom = new Types.ObjectId(newProjectData.forkedFrom);
      }
      const project = await this.projectService.create(data as any);
      return project;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  //   project (by filters)
  @AllowAny()
  @Get('all')
  async findAll(@Query() query: GetProjectsQuery) {
    try {
      const {
        creator,
        collaborator,
        isCompleted,
        isForked,
        title,
        tags,
        full,
        page = 1,
        limit = 10,
      } = query;
      const filters: FilterQuery<Project> = {};
      if (creator) filters.creator = new Types.ObjectId(creator);
      if (collaborator)
        filters.collaborators = { $in: [new Types.ObjectId(collaborator)] };

      // Handle boolean filters with proper type conversion
      if (isCompleted) filters.isCompleted = isCompleted === 'true';
      if (isForked) filters.isForked = isForked === 'true';
      if (title) filters.title = { $regex: title, $options: 'i' };
      if (tags) {
        // If tags is a string, convert to array
        const tagsArray = Array.isArray(tags)
          ? tags
          : tags.split(',').map((tag) => tag.trim());
        console.log(tagsArray, 'wa');
        if (tagsArray.length > 0) filters.tags = { $all: tagsArray };
      }
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const projects = await this.projectService.findAll({
        full: full === 'true',
        filters,
        page: pageNum,
        limit: limitNum,
        order: 1,
        sortField: '-createdAt',
      });

      return projects;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':projectId/invites/users')
  async getUsersEligibleForInvite(@Query() query: GetUsersQuery, @Param('projectId') projectId: string) {
    try {
      const { name, email, page = 1, limit = 1000 } = query;
      const project = await this.projectService.findOne(
        new Types.ObjectId(projectId)
      );
      const filters: FilterQuery<User> = {};
      if (name) {
        filters.$or = [
          { firstName: { $regex: name, $options: 'i' } },
          { lastName: { $regex: name, $options: 'i' } },
        ];
      }
      if (email) filters.email = { $regex: email, $options: 'i' };
      const existingCollaborators = [
        ...(project.collaborators || [])
      ];
      filters._id = { $nin: existingCollaborators };
      const users = await this.usersService.findAll({
        filters,
        page,
        limit,
        order: 1,
        sortField: 'firstName',
      });
      return users;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  @Get('invites/all')
  async findAllCollaborationRequests(@Request() req, @Query() query: { projectId: string }) {
    try {
      const { projectId } = query;
      let filters: any = { collaborator: req.user._id };
      if (projectId) filters = { project: new Types.ObjectId(projectId) };
      const requests = await this.projectService.findCollaborationRequests({
        filters,
        page: 1,
        limit: 150,
        order: -1,
        sortField: 'createdAt',
      });
      return requests;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  // get project (by id)

  @Get(':projectId')
  async findOne(@Request() req, @Param('projectId') projectId: string) {
    try {
      const project = await this.projectService.findOne(
        new Types.ObjectId(projectId),
        {},
        true,
      );

      return project;
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message);
      throw new BadRequestException(error.message);
    }
  }

  @Post(':projectId/invite')
  async inviteCollaborator(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() data: { email: string },
  ) {
    try {
      const user = await this.usersService.findOne(null, { email: data.email });
      const [token, project] = await this.projectService.inviteCollaborator(
        new Types.ObjectId(projectId),
        user._id,
      );
      try {
        await this.emailService.sendMail({
          to: user.email,
          subject: 'Invitation to my project',
          template: 'project-invite',
          context: {
            token,
            userName: user.firstName + ' ' + user.lastName,
            projectName: project.title,
            senderName: req.user.firstName + ' ' + req.user.lastName,
            currentYear: new Date().getFullYear(),
          },
        });
      } catch (error) {
        console.error(error);
      } finally {
        return { token };
      }
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // join existing project
  @Post(':token/join/')
  async joinProject(@Request() req, @Param('token') token: string) {
    try {
      const decoded = decryptObjectId(token);
      const { projectId, userId } = await this.otpService.getToken(
        new Types.ObjectId(decoded),
      );
      const user = await this.usersService.findOne(userId);

      if (!user) throw new BadRequestException('User not found');
      if (!user._id.equals(req.user._id))
        throw new BadRequestException("This token wasn't created for you");
      const added = await this.projectService.addCollaborator(
        projectId,
        user._id,
      );
      return added;
    } catch (error) {
      console.error(error);
      throw new BadRequestException(error.message);
    }
  }

  @Post(':projectId/invites/cancel')
  @HttpCode(200)
  async cancelCollaboratorInvite(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() data: { email: string },
  ) {
    try {
      const user = await this.usersService.findOne(null, { email: data.email });
      await this.projectService.cancelCollaborationRequest(
        new Types.ObjectId(projectId),
        user._id,
      );
      return {
        message: `The invitation to ${user.firstName + ' ' + user.lastName} has been canceled`,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // delete project
  // get project collaborators
  // add project collaborator
  // remove project collaborator
  // delete project
}
