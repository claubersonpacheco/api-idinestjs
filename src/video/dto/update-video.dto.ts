import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateVideoDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  folderId?: number;
}
