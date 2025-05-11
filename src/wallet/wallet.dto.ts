import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
