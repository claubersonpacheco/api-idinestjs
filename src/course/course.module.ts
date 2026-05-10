import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/category.entity';
import { MoodleModule } from '../moodle/moodle.module';
import { Role } from '../role/role.entity';
import { Setting } from '../setting/setting.entity';
import { User } from '../user/user.entity';
import { CourseController } from './course.controller';
import { CourseEnrollment } from './course-enrollment.entity';
import { Course } from './course.entity';
import { CourseService } from './course.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Category, CourseEnrollment, User, Role, Setting]),
    MoodleModule,
  ],
  controllers: [CourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
