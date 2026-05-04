import { IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateVideoUploadDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsInt()
  @Min(1)
  folderId: number;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  filePath?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  collection?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  type?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  thumbnail?: string;

  @IsString()
  @IsNotEmpty()
  fileType: string;
}
