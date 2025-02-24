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

    @Prop({ type: [Types.ObjectId], ref: 'User', required: true }) // Specify as an array
    members: Types.ObjectId[];

    @Prop({ default: Date.now })
    createdAt: Date;

    @Prop({ default: Date.now })
    updatedAt: Date;

    @Prop({ type: Boolean, default: false})
    isGroup: boolean;

    @Prop({ type: [Types.ObjectId], ref:"User", default: []})
    admins: Types.ObjectId[];
}

@Schema()
export class Message {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    sender: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversation: Types.ObjectId;

    @Prop({type: String, required: true })
    content: string;

    @Prop({ default: Date.now })
    createdAt: Date;

    @Prop({ type: Date,  default: Date.now })
    updatedAt: Date;

    @Prop({ type: Boolean, default: false})
    isRead: boolean;

    @Prop({ type: Boolean, default: false})
    isEdited: boolean;
}

export const ConversationSchema =
    SchemaFactory.createForClass(Conversation);
export const MessageSchema = SchemaFactory.createForClass(Message);
