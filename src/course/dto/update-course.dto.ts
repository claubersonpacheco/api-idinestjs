import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  fullname?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  shortname?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  mcode?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1)
  visible?: string;

  @IsOptional()
  @IsBooleanString()
  isPublic?: string;

  @IsOptional()
  @IsDateString()
  startdate?: string;

  @IsOptional()
  @IsDateString()
  enddate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;
}
