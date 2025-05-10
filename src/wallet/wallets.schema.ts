import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { User } from 'src/users/users.schema';

export type SuiWalletDocument = HydratedDocument<SuiWallet>;

@Schema()
export class SuiWallet {
  @Prop({ required: true, unique: true })
  address: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true, default: Date.now })
  createdAt: Date;

  @Prop({ required: true, default: Date.now })
  updatedAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const SuiWalletSchema = SchemaFactory.createForClass(SuiWallet);
