import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length, Min } from 'class-validator';
import { IsMoodlePassword } from '../../user/dto/moodle-password.decorator';

export class PublicCourseRegisterDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  username: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastname?: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @IsMoodlePassword()
  password: string;

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
