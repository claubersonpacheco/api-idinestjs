import { IsNotEmpty, IsString } from 'class-validator';
import { IsMoodlePassword } from '../../user/dto/moodle-password.decorator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsMoodlePassword()
  password: string;
}
