import { IsOptional, IsString, Length } from 'class-validator';

export class CompleteVideoUploadDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  guid?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  videoLibraryId?: string;
}
