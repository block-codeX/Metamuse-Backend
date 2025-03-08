import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type DrawingDocument = HydratedDocument<Drawing>;

@Schema()
export class Drawing {
    @Prop({ required: true })
    title: string;
    @Prop()
    description: string;
    @Prop({ type: [Types.ObjectId], ref: 'User', required: true }) // Specify as an array
    artists: Types.ObjectId[];
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    creator: Types.ObjectId;
    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversation: Types.ObjectId;
    @Prop({ default: Date.now })
    createdAt: Date;
    @Prop({ default: Date.now })
    updatedAt: Date;
    @Prop({ type: JSON, default: {} })
    data: JSON;

}

export const DrawingSchema = SchemaFactory.createForClass(Drawing);