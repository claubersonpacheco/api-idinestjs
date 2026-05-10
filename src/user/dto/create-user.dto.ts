import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

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
  @MinLength(6)
  password: string;
}
