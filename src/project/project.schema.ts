import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ProjectDocument = HydratedDocument<Project>;

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

export const ProjectSchema = SchemaFactory.createForClass(Project);