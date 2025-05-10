/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './wallet.dto';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  async createWallet(@Request() req, @Body() createWalletDto: CreateWalletDto) {
    const userId = req.user.userId;
    return this.walletService.createWallet(userId, createWalletDto);
  }

  @Get()
  async getAllWallets(@Request() req) {
    const userId = req.user.userId;
    return this.walletService.getWalletsByUserId(userId);
  }

  @Get(':id')
  async getWallet(@Request() req, @Param('id') walletId: string) {
    const userId = req.user.userId;
    return this.walletService.getWalletById(userId, walletId);
  }

  @Get('address/:address')
  async getWalletByAddress(@Request() req, @Param('address') address: string) {
    const userId = req.user.userId;
    return this.walletService.getWalletByAddress(userId, address);
  }

  @Patch(':id')
  async updateWallet(
    @Request() req,
    @Param('id') walletId: string,
    @Body() updateData: Partial<CreateWalletDto>,
  ) {
    const userId = req.user.userId;
    return this.walletService.updateWallet(userId, walletId, updateData);
  }

  @Delete(':id')
  async deleteWallet(@Request() req, @Param('id') walletId: string) {
    const userId = req.user.userId;
    // Using soft delete by default for safety
    return this.walletService.softDeleteWallet(userId, walletId);
  }

  @Delete(':id/permanent')
  async permanentlyDeleteWallet(@Request() req, @Param('id') walletId: string) {
    const userId = req.user.userId;
    return this.walletService.hardDeleteWallet(userId, walletId);
  }
}
