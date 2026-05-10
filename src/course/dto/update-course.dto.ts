import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
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
  @Length(1, 512)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1)
  visible?: string;

  @IsOptional()
  @IsBooleanString()
  isPublic?: string;

  @IsOptional()
  @IsIn(['open', 'private'])
  accessType?: 'open' | 'private';

  @IsOptional()
  @IsIn(['free', 'paid'])
  pricingType?: 'free' | 'paid';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsIn(['unlimited', 'limited'])
  capacityType?: 'unlimited' | 'limited';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacityLimit?: number;

  @IsOptional()
  @IsIn(['pix', 'boleto', 'card', 'bank_transfer', 'cash_in_person'], { each: true })
  paymentMethods?: string[];

  @IsOptional()
  @IsIn(['cash', 'installments', 'both'])
  paymentTerms?: 'cash' | 'installments' | 'both';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxInstallments?: number;

  @IsOptional()
  @IsString()
  bankTransferDetails?: string;

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
