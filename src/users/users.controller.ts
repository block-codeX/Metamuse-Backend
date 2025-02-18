import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { NotFoundError } from '@app/utils';
import { FilterQuery, Types } from 'mongoose';
import { User } from './users.schema';

interface GetUsersQuery {
    firstName?: string;
    lastName?: string;
    email?: string;
    page?: number;
    limit?: number;
}

@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
    ) {}

    @Get()
    async getUser(@Param() id: string) {
        try {
            const user_id = Types.ObjectId.createFromHexString(id);
            const user =  await this.usersService.findOne(user_id) as any;
            return user.select('-password, -lastAuthChange, -__v').toObject();
        }
        catch (error) {
            if (error instanceof NotFoundError)
                throw new NotFoundException(error.message, error.name);
            throw new BadRequestException(error.message);

        }
    }
    @Post()
    async deleteUser(@Param() id: string) {
        try {
            const user_id = Types.ObjectId.createFromHexString(id);
            const user =  await this.usersService.remove(user_id) as any;
            return {"message": "User successfully deleted"}
            // Probably send an email informing the user that he/she has been deleted...
        }
        catch (error) {
            if (error instanceof NotFoundError)
                throw new NotFoundException(error.message, error.name);
            throw new BadRequestException(error.message);

        }
    }
    @Get('all')
    async getUsers(@Query() query: GetUsersQuery) {
        try {
            const { firstName, lastName, email, page = 1, limit = 10 } = query;
            const filters: FilterQuery<User>  = {}
            if (firstName) filters.firstName = firstName;
            if (lastName) filters.lastName = lastName;
            if (email) filters.email = email;
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
