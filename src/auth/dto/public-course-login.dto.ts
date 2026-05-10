import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LoginDto } from './login.dto';

export class PublicCourseLoginDto extends LoginDto {
  @IsOptional()
  @IsIn(['pix', 'boleto', 'card', 'bank_transfer', 'cash_in_person'])
  paymentMethod?: 'pix' | 'boleto' | 'card' | 'bank_transfer' | 'cash_in_person';

  @IsOptional()
  @IsIn(['cash', 'installments'])
  paymentTerm?: 'cash' | 'installments';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  installments?: number;
}
