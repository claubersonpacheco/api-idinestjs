import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { IsMoodlePassword } from './moodle-password.decorator';

export class CreateUserDto {
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

  @IsOptional()
  @IsInt()
  moodleUserId?: number;

  @IsOptional()
  @IsInt()
  roleId?: number;

  @IsString()
  @IsNotEmpty()
  @IsMoodlePassword()
  password: string;
}
