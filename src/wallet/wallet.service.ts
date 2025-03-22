import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SuiWallet, SuiWalletDocument } from './wallets.schema';
import { CreateWalletDto } from './wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(SuiWallet.name)
    private walletModel: Model<SuiWalletDocument>,
  ) {}

  /**
   * Create a new wallet for a user
   */
  async createWallet(
    userId: string,
    createWalletDto: CreateWalletDto,
  ): Promise<SuiWallet> {
    // Check if the wallet address already exists
    const existingWallet = await this.walletModel
      .findOne({
        address: createWalletDto.address,
      })
      .exec();

    if (existingWallet) {
      throw new BadRequestException('Wallet address already exists');
    }

    const newWallet = new this.walletModel({
      ...createWalletDto,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return newWallet.save();
  }

  /**
   * Get all wallets for a user
   */
  async getWalletsByUserId(userId: string): Promise<SuiWallet[]> {
    return this.walletModel.find({ userId }).exec();
  }

  /**
   * Get a specific wallet by ID
   */
  async getWalletById(userId: string, walletId: string): Promise<SuiWallet> {
    const wallet = await this.walletModel
      .findOne({
        _id: walletId,
        userId,
      })
      .exec();

    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${walletId} not found`);
    }

    return wallet;
  }

  /**
   * Get a specific wallet by address
   */
  async getWalletByAddress(
    userId: string,
    address: string,
  ): Promise<SuiWallet> {
    const wallet = await this.walletModel
      .findOne({
        address,
        userId,
      })
      .exec();

    if (!wallet) {
      throw new NotFoundException(`Wallet with address ${address} not found`);
    }

    return wallet;
  }

  /**
   * Update a wallet
   */
  async updateWallet(
    userId: string,
    walletId: string,
    updateData: Partial<SuiWallet>,
  ): Promise<SuiWallet> {
    const wallet = await this.walletModel
      .findOneAndUpdate(
        { _id: walletId, userId },
        { ...updateData, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${walletId} not found`);
    }

    return wallet;
  }

  /**
   * Delete a wallet (sets isActive to false)
   */
  async softDeleteWallet(userId: string, walletId: string): Promise<SuiWallet> {
    const wallet = await this.walletModel
      .findOneAndUpdate(
        { _id: walletId, userId },
        { isActive: false, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${walletId} not found`);
    }

    return wallet;
  }

  /**
   * Permanently delete a wallet
   */
  async hardDeleteWallet(
    userId: string,
    walletId: string,
  ): Promise<{ deleted: boolean }> {
    const result = await this.walletModel
      .deleteOne({
        _id: walletId,
        userId,
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Wallet with ID ${walletId} not found`);
    }

    return { deleted: true };
  }
}
