import { Types } from "mongoose";

export interface INewWallet {
    user: Types.ObjectId;
    network: string;
    name: string;
    address: string;
    provider?: string;
}

export interface IWallet {
    user: Types.ObjectId;
    network: string;
    name: string;
    address: string;
    provider?: string;
    isVerified?: boolean;
    lastUsedAt?: Date;
    isActive: boolean;
}
export interface ICreateWallet{
    network: string
    name: string;
    address: string;
    provider?: string;
    user?: Types.ObjectId;
  }