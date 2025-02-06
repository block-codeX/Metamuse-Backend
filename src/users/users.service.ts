import { Injectable } from '@nestjs/common';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './users.schema';
import { NotFoundError, PaginatedDocs, ValidationError, paginate, validatePhone } from '@app/utils';
import { encryptPassword } from '@app/utils/utils.encrypt';

interface UserParams {
    phone: string
    firstName: string
    lastName: string
    email: string
    password: string
}

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<User>,
    ) { }

    async getUsers({
        filters = {},
        page = 1,
        limit = 10,
        order = -1,
        sortField = 'email'
    }: {
        filters: FilterQuery<User>
        page: number
        limit: number
        order: SortOrder
        sortField: string
    }): Promise<PaginatedDocs<User>> {
        const fieldsToExclude = ['-password', '-secret', '-otpExpires', '-lastAuthChange', '-__v']
        return await paginate(this.userModel, filters, { page, limit, sortField, sortOrder: order }, fieldsToExclude)
    }

    async getUser(id: Types.ObjectId): Promise<User> {
        const user = await this.userModel.findOne({ _id: id }).lean().exec()
        if (user == null) throw new NotFoundError('User not found')
        return user
    }

    async updateUser(
        id: Types.ObjectId,
        { phone, firstName, lastName, email, password }: Partial<UserParams>
    ): Promise<User> {
        const updateData: any = {} // Partial<UserParams> = {};

        if (phone) {
            if (!validatePhone(phone)) {
                throw new ValidationError('Invalid phone number')
            }
            updateData.phone = phone
        }

        if (firstName) updateData.firstName = firstName
        if (lastName) updateData.lastName = lastName
        if (email) updateData.email = email
        if (password) {
            updateData.password = encryptPassword(password)
            updateData.lastAuthChange = new Date(Date.now())
        }

        const updatedUser = await this.userModel.findByIdAndUpdate(id, updateData, {
            new: true
        })
            .lean()
            .exec()
        if (!updatedUser) {
            throw new NotFoundError('User not found')
        }
        return updatedUser
    }
      async deleteUser(id: Types.ObjectId): Promise<User> {
        const user = await this.userModel.findOneAndDelete({ _id: id });
        if (user == null) throw new NotFoundError('User not found');
        return user;
      }
}
