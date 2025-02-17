import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;
export type MessageDocument = HydratedDocument<Message>;
@Schema()
export class Conversation {
    @Prop({ default: ""})
    name: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    creator: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    members: Types.ObjectId[];

    @Prop({ default: Date.now })
    createdAt: Date;

    @Prop({ default: Date.now })
    updatedAt: Date;

    @Prop({ default: false})
    isGroup: boolean;

    @Prop({ type: Types.ObjectId, ref:"User", default: []})
    admins: Types.ObjectId[];
}

export class Message {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    sender: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversation: Types.ObjectId;

    @Prop({ required: true })
    content: string;

    @Prop({ default: Date.now })
    createdAt: Date;

    @Prop({ default: Date.now })
    updatedAt: Date;

    @Prop({ default: false})
    isRead: boolean;

    @Prop({ default: false})
    isEdited: boolean;
}

export class BlacklistAccess {
  @Prop({ required: true, unique: true })
  token: string;
}

export const ConversationSchema =
    SchemaFactory.createForClass(Conversation);
export const MessageSchema = SchemaFactory.createForClass(Message);
