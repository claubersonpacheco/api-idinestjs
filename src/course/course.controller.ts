import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Course } from './course.entity';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { EnrollUserDto } from './dto/enroll-user.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller('courses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @RequirePermissions('courses.read')
  findAll(): Promise<Course[]> {
    return this.courseService.findAll();
  }

  @Get('my/enrollments')
  findMyEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.courseService.findEnrollmentsByUser(user.sub);
  }

  @Get(':id')
  @RequirePermissions('courses.read')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Course> {
    return this.courseService.findOne(id);
  }

  @Post()
  @RequirePermissions('courses.create')
  create(@Body() dto: CreateCourseDto): Promise<Course> {
    return this.courseService.create(dto);
  }

  @Get(':id/enrollments')
  @RequirePermissions('courses.read')
  findEnrollments(@Param('id', ParseIntPipe) id: number) {
    return this.courseService.findEnrollments(id);
  }

  @Get(':id/moodle-login-url')
  getMoodleLoginUrl(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courseService.getMoodleLoginUrlForCourse(user.sub, id);
  }

  @Post(':id/enrollments')
  @RequirePermissions('courses.update')
  enrollUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnrollUserDto,
  ) {
    return this.courseService.enrollUser(id, dto);
  }

  @Post(':id/image')
  @RequirePermissions('courses.update')
  @UseInterceptors(FileInterceptor('image'))
  uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedImageFile,
  ): Promise<Course> {
    return this.courseService.uploadCourseImage(id, file);
  }

  @Delete(':id/enrollments/:enrollmentId')
  @RequirePermissions('courses.update')
  unenrollUser(
    @Param('id', ParseIntPipe) id: number,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
  ) {
    return this.courseService.unenrollUser(id, enrollmentId);
  }

  @Patch(':id/enrollments/:enrollmentId/approve-payment')
  @RequirePermissions('courses.update')
  approveEnrollmentPayment(
    @Param('id', ParseIntPipe) id: number,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
  ) {
    return this.courseService.approveEnrollmentPayment(id, enrollmentId);
  }

  @Patch(':id')
  @RequirePermissions('courses.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourseDto,
  ): Promise<Course> {
    return this.courseService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('courses.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.courseService.remove(id);
  }
}
