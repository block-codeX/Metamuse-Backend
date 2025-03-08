import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ProjectDocument = HydratedDocument<Project>;
export type SnapshotDocument = HydratedDocument<Snapshot>;

@Schema({ timestamps: true })
export class Snapshot {
    @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
    project: Types.ObjectId; // Reference to the original project
    @Prop({ type: String, required: false })
    name: string; // Optional name for the snapshot
    @Prop({ type: String, required: false })
    description: string; // Optional description for the snapshot
    @Prop({ type: [Buffer], required: true })
    stateChunks: Buffer[]; // Store Yjs document state as chunks
    @Prop({ type: Number, required: true })
    chunkCount: number; // Total number of chunks
    @Prop({ type: Number, required: true })
    chunkSize: number; // Size of each chunk in bytes
    @Prop({ type: Date, default: Date.now })
    createdAt: Date; // Timestamp when the snapshot was created
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    creator: Types.ObjectId; // User who created the snapshot
}

@Schema()
export class Project {
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

export const DrawingSchema = SchemaFactory.createForClass(Project);