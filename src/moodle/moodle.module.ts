import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../setting/setting.entity';
import { MoodleService } from './moodle.service';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [MoodleService],
  exports: [MoodleService],
})
export class MoodleModule {}
