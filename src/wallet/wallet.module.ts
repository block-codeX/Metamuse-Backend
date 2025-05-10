import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuiWallet, SuiWalletSchema } from './wallets.schema';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SuiWallet.name, schema: SuiWalletSchema },
    ]),
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService, MongooseModule],
})
export class WalletModule {}
