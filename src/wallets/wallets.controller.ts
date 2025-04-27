import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  BadRequestException,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { ICreateWallet, INewWallet } from './wallets.dto';
import { Types } from 'mongoose';
import { NotFoundError, ValidationError } from '@app/utils/utils.errors';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  async create(@Request() req, @Body() newWalletData: ICreateWallet) {
    try {
      newWalletData.user = req.user._id;
      const newWallet = await this.walletsService.create(newWalletData as INewWallet);
      return newWallet;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async findAll(@Request() req) {
    try {
      const filters: any = { user: req.user };
      return await this.walletsService.findAll({
        filters,
        page: 1,
        limit: 50,
        order: -1,
        sortField: 'lastUsedAt',
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    try {
      const walletId = new Types.ObjectId(id);
      const wallet = await this.walletsService.findOne(walletId);
      if (!wallet.user.equals(req.user._id)) {
        throw new ValidationError('You are not the owner of this wallet');
      }
      return wallet;
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/activity-toggle')
  async toggleWalletAsActive(@Request() req, @Param('id') id: string) {
    try {
      const walletId = new Types.ObjectId(id);
      return await this.walletsService.toggleWalletAsActive(walletId, req.user);
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }
  @Post(':id/default')
  async setWalletAsDefault(@Request() req, @Param('id') id: string) {
    try {
      const walletId = new Types.ObjectId(id);
      const [wallet, user] = await this.walletsService.setWalletAsDefault(
        walletId,
        req.user,
      );
      const { __v, lastAuthChange, password, ...userData } = user;
      return { message: 'Wallet reset successfully', wallet, userData };
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    throw new BadRequestException("Not yet sure people should be able to remove wallets")
  }
}
