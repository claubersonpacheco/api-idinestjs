import { IsOptional, IsString, Length } from 'class-validator';

export class PixCallbackDto {
  @IsString()
  @Length(1, 35)
  txid: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  amount?: number;

  @IsOptional()
  @IsString()
  secret?: string;
}
