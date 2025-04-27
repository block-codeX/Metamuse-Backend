import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { boolean } from 'zod';

export type WalletDocument = HydratedDocument<Wallet>;

@Schema({ timestamps: true })
export class Wallet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: String, required: true })
  network: string; // e.g., 'ethereum', 'polygon', 'solana'

  @Prop({ type: String, required: true })
  name: string; // e.g., 'Main Wallet', 'Backup Wallet'

  @Prop({ type: String, required: true, unique: true })
  address: string; // wallet address (ideally store lowercase)

  @Prop({ type: String })
  provider?: string; // e.g., 'metamask', 'walletconnect'

  @Prop({ type: Boolean, default: false })
  isVerified?: boolean; // has user signed a verification message?

  @Prop({ type: Boolean, default: false })
  isActive?: boolean; // is the wallet active?

  @Prop({ type: Date })
  lastUsedAt?: Date; // when was it last used
}
export const WalletSchema = SchemaFactory.createForClass(Wallet);
WalletSchema.index({ user: 1, network: 1, address: 1 }, { unique: true });
