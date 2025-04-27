import { Injectable } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { INewWallet } from './wallets.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Wallet } from './wallets.schema';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import BaseError, { NotFoundError, ValidationError } from '@app/utils/utils.errors';
import { PaginatedDocs, paginate } from '@app/utils';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private readonly walletModel: Model<Wallet>,
  ) {}
  async create(createWalletDto: INewWallet) {
    const newWallet = await this.walletModel.create(createWalletDto);
    if (!newWallet) {
      throw new BaseError('Error creating wallet');
      console.error('Error creating wallet', newWallet);
    }
    return newWallet;
  }
  async findAll({
    filters = {},
    page = 1,
    limit = 10000,
    order = -1,
    sortField = '-lastUsedAt'
  }: {
      filters: FilterQuery<Wallet>;
      page: number;
      limit: number;
      order: SortOrder;
      sortField: string;
    }): Promise<PaginatedDocs<Wallet>> {
      const fieldsToExclude = ['-password', '-lastAuthChange', '-__v'];
      return await paginate(
        this.walletModel,
        filters,
        { page, limit, sortField, sortOrder: order },
        fieldsToExclude,
      );
    }

  async findOne(id: Types.ObjectId) {
    const wallet = await this.walletModel.findById(id);
    if (!wallet) throw new NotFoundError('Wallet not found');
    return wallet;
  }

  async toggleWalletAsActive(id: Types.ObjectId) {
    const wallet = await this.findOne(id);
    wallet.isActive = !wallet.isActive;
    await wallet.save();
    return wallet;
  }

  async setWalletAsDefault(id: Types.ObjectId, user) {
    const wallet = await this.findOne(id);
    if (wallet.user.toString() !== user._id.toString()) {
      throw new ValidationError('You are not the owner of this wallet');
    }
    user.walletAddress = wallet.address
    await user.save();
    return [wallet, user];
  }

  async useWallet(id: Types.ObjectId) {
    const wallet = await this.findOne(id);
    wallet.lastUsedAt = new Date();
    await wallet.save();
    return wallet;
  }

  async remove(id: Types.ObjectId) {
    const wallet = await this.findOne(id)
    await wallet.deleteOne()
    return wallet
  }
}
