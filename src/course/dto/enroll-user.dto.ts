import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class EnrollUserDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId: number;
}
