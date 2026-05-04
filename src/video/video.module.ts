import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from '../folder/folder.entity';
import { Setting } from '../setting/setting.entity';
import { User } from '../user/user.entity';
import { VideoController } from './video.controller';
import { Video } from './video.entity';
import { VideoService } from './video.service';

@Module({
  imports: [TypeOrmModule.forFeature([Video, User, Setting, Folder])],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
