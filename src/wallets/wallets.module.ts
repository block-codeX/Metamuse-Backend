import { Module } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { Wallet, WalletSchema } from './wallets.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { OTPRequired } from 'src/auth/auth.guard';
import { OTPService } from 'src/auth/auth.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Wallet.name, schema: WalletSchema }]),
    AuthModule
  ],

  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService, MongooseModule],
})
export class WalletsModule {}
