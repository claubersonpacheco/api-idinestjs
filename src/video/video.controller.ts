import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CompleteVideoUploadDto } from './dto/complete-video-upload.dto';
import { CreateVideoUploadDto } from './dto/create-video-upload.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { Video } from './video.entity';
import { VideoService } from './video.service';

@Controller('videos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get()
  @RequirePermissions('videos.read')
  findAll(): Promise<Video[]> {
    return this.videoService.findAll();
  }

  @Get(':id')
  @RequirePermissions('videos.read')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Video> {
    return this.videoService.findOne(id);
  }

  @Post('init-upload')
  @RequirePermissions('videos.create')
  initUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVideoUploadDto,
  ): Promise<{
    video: Video;
    tus: {
      endpoint: string;
      authorizationSignature: string;
      authorizationExpire: number;
      libraryId: string;
      videoId: string;
    };
  }> {
    return this.videoService.initUpload(user.sub, dto);
  }

  @Patch(':id/complete')
  @RequirePermissions('videos.update')
  completeUpload(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteVideoUploadDto,
  ): Promise<Video> {
    return this.videoService.completeUpload(id, dto);
  }

  @Patch(':id')
  @RequirePermissions('videos.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVideoDto,
  ): Promise<Video> {
    return this.videoService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('videos.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.videoService.remove(id);
  }
}
