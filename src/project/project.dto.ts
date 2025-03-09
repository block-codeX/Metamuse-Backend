import { Types } from "mongoose";

export interface UpdateProjectDto {
    title: string;
    description: string;
}

export interface CreateProjectDto {
    title: string;
    description: string;
    creator: Types.ObjectId;
    isForked?: boolean;
    forkedFrom?: Types.ObjectId;
    gridFsId?: string;
}