import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { IsMoodlePassword } from './moodle-password.decorator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastname?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1)
  suspended?: string;

  @IsOptional()
  @IsInt()
  moodleUserId?: number;

  @IsOptional()
  @IsInt()
  roleId?: number;

  @IsOptional()
  @IsString()
  @IsMoodlePassword()
  password?: string;
}
