import { IsNotEmpty, IsString } from 'class-validator';
import { IsMoodlePassword } from '../../user/dto/moodle-password.decorator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsMoodlePassword()
  password: string;
}
