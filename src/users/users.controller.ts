import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { NotFoundError } from '@app/utils';
import { FilterQuery, Types } from 'mongoose';
import { User } from './users.schema';
import { AllowAny } from 'src/auth/auth.decorator';

interface GetUsersQuery {
  name?: string;
  email?: string;
  page?: number;
  limit?: number;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @AllowAny()
  @Get(':id')
  async getUser(@Param() id: string) {
    try {
      const user_id = new Types.ObjectId(id);
      const user = (await this.usersService.findOne(user_id)) as any;
      const { password, lastAuthChange, __v, ...userObject } = user.toObject();
      return userObject;
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }
  @Delete(':id')
  async deleteUser(@Param() id: string) {
    try {
      const user_id = new Types.ObjectId(id);
      const user = (await this.usersService.remove(user_id)) as any;
      return { message: 'User successfully deleted' };
      // Probably send an email informing the user that he/she has been deleted...
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }
  @AllowAny()
  @Get('all')
  async getUsers(@Query() query: GetUsersQuery) {
    try {
      const { name, email, page = 1, limit = 1000 } = query;
      const filters: FilterQuery<User> = {};
      if (name) {
        filters.$or = [
          { firstName: { $regex: name, $options: 'i' } },
          { lastName: { $regex: name, $options: 'i' } },
        ];
      }
      if (email) filters.email = { $regex: email, $options: 'i' };
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
}
