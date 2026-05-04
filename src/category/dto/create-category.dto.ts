import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsInt()
  mcode?: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  description?: string;
}
