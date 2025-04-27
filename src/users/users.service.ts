import { Injectable } from '@nestjs/common';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './users.schema';
import {
  IntegrityError,
  NotFoundError,
  PaginatedDocs,
  UnauthorizedError,
  ValidationError,
  paginate,
  validatePhone,
} from '@app/utils';
import { encryptPassword, verifyPassword } from '@app/utils/utils.encrypt';

interface UserParams {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async loginUser(email: string, password: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ email });
    if (user == null) throw new NotFoundError(`User  with ${email} not found`);
    if (!verifyPassword(password, user.password)) {
      throw new UnauthorizedError('Invalid password');
    }
    return user;
  }
  async signupUser({
    firstName,
    lastName,
    email,
    password,
  }: UserParams): Promise<UserDocument> {
    try {
      const user = await this.userModel.create({
        firstName,
        lastName,
        email,
        password: encryptPassword(password),
      });
      return user;
    } catch (error) {
      if (error && error?.code === 11000) {
        throw new IntegrityError('Email already exists');
      }
      throw error;
    }
  }

  async findAll({
    filters = {},
    page = 1,
    limit = 10,
    order = -1,
    sortField = 'email',
  }: {
    filters: FilterQuery<User>;
    page: number;
    limit: number;
    order: SortOrder;
    sortField: string;
  }): Promise<PaginatedDocs<User>> {
    const fieldsToExclude = ['-password', '-lastAuthChange', '-__v'];
    return await paginate(
      this.userModel,
      filters,
      { page, limit, sortField, sortOrder: order },
      fieldsToExclude,
    );
  }

  async findOne(id: Types.ObjectId | null, query: any = {}): Promise<UserDocument> {
    if (id) {
      query._id = id; 
    }
    const user = await this.userModel.findOne(query);
    if (user == null) throw new NotFoundError('User not found');
    return user;
  }

  async update(
    id: Types.ObjectId,
    { firstName, lastName, email, password }: Partial<UserParams>,
  ): Promise<User> {
    const updateData: any = {}; // Partial<UserParams> = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (password) {
      updateData.password = encryptPassword(password);
      updateData.lastAuthChange = new Date(Date.now());
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateData, {
        new: true,
      })
      .lean()
      .exec();
    if (!updatedUser) {
      throw new NotFoundError('User not found');
    }
    return updatedUser;
  }
  async remove(id: Types.ObjectId): Promise<UserDocument> {
    const user = await this.userModel.findOneAndDelete({ _id: id });
    if (user == null) throw new NotFoundError('User not found');
    return user;
  }
}
