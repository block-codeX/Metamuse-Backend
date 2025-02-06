import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  JWT_ACCESS_TOKEN_EXPIRATION,
  JWT_REFRESH_TOKEN_EXPIRATION,
} from './auth.constants';

export type BlacklistAccessDocument = HydratedDocument<BlacklistAccess>;
export type BlacklistRefreshDocument = HydratedDocument<BlacklistRefresh>;
@Schema({
  timestamps: true,
  expires: JWT_ACCESS_TOKEN_EXPIRATION,
})
export class BlacklistAccess {
  @Prop({ required: true })
  token: string;
}

@Schema({
  timestamps: true,
  expires: JWT_REFRESH_TOKEN_EXPIRATION,
})
export class BlacklistRefresh {
  @Prop({ required: true })
  token: string;
}
export const BlacklistRefreshSchema =
  SchemaFactory.createForClass(BlacklistRefresh);
export const BlacklistAccessSchema =
  SchemaFactory.createForClass(BlacklistAccess);
