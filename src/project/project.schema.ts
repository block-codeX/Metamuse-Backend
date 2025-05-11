import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ProjectDocument = HydratedDocument<Project>;
export type CollaborationRequestDocument = HydratedDocument<CollaborationRequest>;
@Schema({ timestamps: true })
export class Project {
    @Prop({ required: true })
    title: string;

    @Prop()
    description: string;

    @Prop({ type: Types.ObjectId, ref: 'Snapshot', required: false })
    forkedFrom: Types.ObjectId;
    
    @Prop({ type: Boolean, ref: 'Snapshot', default: false })
    isForked: Types.ObjectId;
    
    @Prop({ type: String,  required: false})
    gridFsId: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    creator: Types.ObjectId;
    
    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversation: Types.ObjectId;
      
    @Prop({ type: [Types.ObjectId], ref: 'User', required: true }) // Specify as an array
    collaborators: Types.ObjectId[];

    @Prop({ type: [String], default: []})
    tags: string[];
}

@Schema({ timestamps: true })
export class CollaborationRequest {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    collaborator: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
    project: Types.ObjectId;

    @Prop({ type: String, required: true})
    token: String
}

export const CollaborationRequestSchema = SchemaFactory.createForClass(CollaborationRequest);
CollaborationRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 432000 });
export const ProjectSchema = SchemaFactory.createForClass(Project);