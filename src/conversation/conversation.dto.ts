import { Types } from "mongoose";

export interface ICreateConversation {
    name?: string;
    isGroup?: boolean;
    creator: Types.ObjectId;
    members?: Types.ObjectId[];
    admins?: Types.ObjectId[];
  }
  
export class CreateMessagingDto {
  sender: Types.ObjectId;
  conversation: Types.ObjectId;
  content: string; 
}

export class UpdateMessagingDto {
  content: string;
}



