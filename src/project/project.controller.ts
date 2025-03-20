import {
  Body,
  Controller,
  Request,
  ValidationPipe,
  UsePipes,
  Post,
  BadRequestException,
  Get,
  Query,
} from '@nestjs/common';
import {
  CreateProjectDto,
  NewProjectDto,
  newProjectSchema,
} from './project.dto';
import { ProjectService } from './project.service';
import { PaginatedQuery, ZodValidationPipe } from '@app/utils';
import { FilterQuery, Types } from 'mongoose';
import { AllowAny } from 'src/auth/auth.decorator';
import { Project } from './project.schema';
interface GetProjectsQuery extends PaginatedQuery {
  creator?: string;
  isCompleted: string;
  isForked: string;
  tags: string;
  collaborator?: string;
  title?: string;
}

@Controller('projects')
export class ProjectController {
  // Create project
  constructor(private readonly projectService: ProjectService) {}
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
        if (tagsArray.length > 0) filters.tags = { $all: tagsArray };
      }
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const projects = await this.projectService.findAll({
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

  // get project (by id)
  // delete project
  // get project collaborators
  // add project collaborator
  // remove project collaborator
  // invite project collaborator
  // join existing project
  // delete project
  // get file
  // all project snapshots ( by filters )
}
