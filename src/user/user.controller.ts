import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponse, UserService } from './user.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  private isMaster(user: AuthenticatedUser): boolean {
    return user.role?.name.toLowerCase() === 'master';
  }

  private hasPermission(user: AuthenticatedUser, permission: string): boolean {
    if (this.isMaster(user)) {
      return true;
    }

    return (
      user.role?.permissions.some((item) => item.name === permission) ?? false
    );
  }

  @Get()
  @RequirePermissions('users.read')
  findAll(): Promise<UserResponse[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  @RequirePermissions('users.read')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponse> {
    return this.userService.findOne(id);
  }

  @Post()
  @RequirePermissions('users.create')
  create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserResponse> {
    return this.userService.create(createUserDto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    if (!this.isMaster(user)) {
      delete updateUserDto.suspended;
    }

    if (!this.hasPermission(user, 'users.update')) {
      if (user.sub !== id) {
        throw new ForbiddenException('User does not have permission.');
      }

      delete updateUserDto.roleId;
      delete updateUserDto.moodleUserId;
      delete updateUserDto.password;
    }

    if (!this.hasPermission(user, 'user.email')) {
      delete updateUserDto.email;
    }

    return this.userService.update(id, updateUserDto);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo'))
  uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedImageFile,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    if (!this.hasPermission(user, 'users.update') && user.sub !== id) {
      throw new ForbiddenException('User does not have permission.');
    }

    return this.userService.uploadPhoto(id, file);
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.userService.remove(id);
  }
}
