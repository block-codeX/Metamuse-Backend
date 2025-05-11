import { Types } from "mongoose";
import { z } from "zod";
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
    tags: string[];
}

export const newProjectSchema =  z.object({
    title: z.string(),
    description: z.string(),
    isForked: z.boolean().optional(),
    forkedFrom: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });

export type NewProjectDto = z.infer<typeof newProjectSchema>