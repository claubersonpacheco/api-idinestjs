import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../category/category.entity';
import { MoodleService } from '../moodle/moodle.service';
import { Role } from '../role/role.entity';
import { User } from '../user/user.entity';
import { CourseEnrollment } from './course-enrollment.entity';
import { Course } from './course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { EnrollUserDto } from './dto/enroll-user.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly moodleService: MoodleService,
  ) {}

  async findAll(): Promise<Array<Course & { enrollmentCount: number }>> {
    const courses = await this.courseRepository.find({ order: { id: 'ASC' } });
    return this.attachEnrollmentCounts(courses);
  }

  async findOne(id: number): Promise<Course & { enrollmentCount: number }> {
    const course = await this.courseRepository.findOneBy({ id });
    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found.`);
    }
    const [courseWithCount] = await this.attachEnrollmentCounts([course]);
    return courseWithCount;
  }

  async findPublicCourse(id: number): Promise<Course & { enrollmentCount: number }> {
    const course = await this.findOne(id);

    if (!course.isPublic) {
      throw new NotFoundException(`Public course with id ${id} not found.`);
    }

    return course;
  }

  async findPublicCourseBySlug(
    slug: string,
  ): Promise<Course & { enrollmentCount: number }> {
    const course = await this.courseRepository.findOne({
      where: {
        shortname: slug,
        isPublic: true,
      },
    });

    if (!course) {
      throw new NotFoundException(`Public course with slug ${slug} not found.`);
    }

    const [courseWithCount] = await this.attachEnrollmentCounts([course]);
    return courseWithCount;
  }

  async findPublicCourses(): Promise<Array<Course & { enrollmentCount: number }>> {
    const courses = await this.courseRepository.find({
      where: {
        isPublic: true,
      },
      order: {
        id: 'ASC',
      },
    });

    return this.attachEnrollmentCounts(courses);
  }

  private async attachEnrollmentCounts(
    courses: Course[],
  ): Promise<Array<Course & { enrollmentCount: number }>> {
    if (!courses.length) {
      return [];
    }

    const rows = (await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .select('enrollment.course_id', 'courseId')
      .addSelect('COUNT(enrollment.id)', 'total')
      .where('enrollment.course_id IN (:...courseIds)', {
        courseIds: courses.map((course) => course.id),
      })
      .groupBy('enrollment.course_id')
      .getRawMany()) as Array<{ courseId: number | string; total: string }>;

    const counts = new Map(
      rows.map((row) => [Number(row.courseId), Number(row.total)]),
    );

    return courses.map((course) =>
      Object.assign(course, {
        enrollmentCount: counts.get(course.id) ?? 0,
      }),
    );
  }

  private async findCategoryOrFail(categoryId: number): Promise<Category> {
    const category = await this.categoryRepository.findOneBy({ id: categoryId });
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found.`);
    }
    return category;
  }

  private async ensureMoodleCategory(category: Category): Promise<number> {
    if (category.mcode) {
      return category.mcode;
    }

    const moodleCategory = await this.moodleService.createCategory({
      name: category.name,
      description: category.description,
    });

    category.mcode = moodleCategory.id;
    await this.categoryRepository.save(category);

    return moodleCategory.id;
  }

  async create(dto: CreateCourseDto): Promise<Course> {
    const category = await this.findCategoryOrFail(dto.categoryId);
    const moodleCategoryId = await this.ensureMoodleCategory(category);
    const startdate = dto.startdate ? new Date(dto.startdate) : null;
    const enddate = dto.enddate ? new Date(dto.enddate) : null;
    const moodleCourse = await this.moodleService.createCourse({
      fullname: dto.fullname.trim(),
      shortname: dto.shortname.trim(),
      categoryId: moodleCategoryId,
      summary: dto.summary?.trim() || null,
      visible: dto.visible?.trim() || null,
      startdate,
      enddate,
    });

    const course = this.courseRepository.create({
      fullname: dto.fullname.trim(),
      shortname: dto.shortname.trim(),
      mcode: String(moodleCourse.id),
      summary: dto.summary?.trim() || null,
      visible: dto.visible?.trim() || null,
      isPublic: dto.isPublic === 'true',
      startdate,
      enddate,
      category,
    });

    try {
      return await this.courseRepository.save(course);
    } catch (error) {
      await this.moodleService
        .deleteCourse(moodleCourse.id)
        .catch(() => undefined);
      throw error;
    }
  }

  async update(id: number, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.findOne(id);

    const nextCategory =
      dto.categoryId !== undefined
        ? await this.findCategoryOrFail(dto.categoryId)
        : course.category;
    const moodleCategoryId = await this.ensureMoodleCategory(nextCategory);
    const startdate =
      dto.startdate !== undefined
        ? dto.startdate
          ? new Date(dto.startdate)
          : null
        : undefined;
    const enddate =
      dto.enddate !== undefined
        ? dto.enddate
          ? new Date(dto.enddate)
          : null
        : undefined;

    if (course.mcode) {
      await this.moodleService.updateCourse({
        id: Number(course.mcode),
        ...(dto.fullname !== undefined ? { fullname: dto.fullname.trim() } : {}),
        ...(dto.shortname !== undefined
          ? { shortname: dto.shortname.trim() }
          : {}),
        ...(dto.categoryId !== undefined ? { categoryId: moodleCategoryId } : {}),
        ...(dto.summary !== undefined
          ? { summary: dto.summary?.trim() || null }
          : {}),
        ...(dto.visible !== undefined ? { visible: dto.visible?.trim() || null } : {}),
        ...(startdate !== undefined ? { startdate } : {}),
        ...(enddate !== undefined ? { enddate } : {}),
      });
    }

    course.category = nextCategory;

    const merged = this.courseRepository.merge(course, {
      ...(dto.fullname !== undefined ? { fullname: dto.fullname.trim() } : {}),
      ...(dto.shortname !== undefined ? { shortname: dto.shortname.trim() } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary?.trim() || null } : {}),
      ...(dto.visible !== undefined ? { visible: dto.visible?.trim() || null } : {}),
      ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic === 'true' } : {}),
      ...(startdate !== undefined ? { startdate } : {}),
      ...(enddate !== undefined ? { enddate } : {}),
    });

    return this.courseRepository.save(merged);
  }

  async remove(id: number): Promise<{ message: string }> {
    const course = await this.findOne(id);
    if (course.mcode) {
      await this.moodleService.deleteCourse(Number(course.mcode));
    }
    await this.courseRepository.remove(course);
    return { message: 'Course deleted successfully.' };
  }

  async findEnrollments(courseId: number): Promise<CourseEnrollment[]> {
    const course = await this.findOne(courseId);
    return this.enrollmentRepository.find({
      where: {
        course: {
          id: course.id,
        },
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async findEnrollmentsByUser(userId: number): Promise<CourseEnrollment[]> {
    return this.enrollmentRepository.find({
      where: {
        user: {
          id: userId,
        },
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async getMoodleLoginUrlForCourse(
    userId: number,
    courseId: number,
  ): Promise<{ url: string }> {
    const course = await this.findOne(courseId);
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found.`);
    }

    if (!course.mcode) {
      throw new BadRequestException('Course does not have a Moodle course id.');
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        course: {
          id: course.id,
        },
        user: {
          id: user.id,
        },
      },
    });

    if (!enrollment) {
      throw new BadRequestException('User is not enrolled in this course.');
    }

    if (enrollment.user.id !== user.id) {
      throw new BadRequestException('Enrollment does not belong to the authenticated user.');
    }

    const url = await this.moodleService.requestLoginUrl({
      moodleUserId: user.moodleUserId,
      username: user.username,
      email: user.email,
      courseId: Number(course.mcode),
    });

    return { url };
  }

  async enrollUser(
    courseId: number,
    dto: EnrollUserDto,
  ): Promise<CourseEnrollment> {
    const course = await this.findOne(courseId);
    const user = await this.userRepository.findOneBy({ id: dto.userId });
    const role = await this.roleRepository.findOneBy({ id: dto.roleId });

    if (!user) {
      throw new NotFoundException(`User with id ${dto.userId} not found.`);
    }

    if (!role) {
      throw new NotFoundException(`Role with id ${dto.roleId} not found.`);
    }

    if (!course.mcode) {
      throw new BadRequestException('Course does not have a Moodle course id.');
    }

    if (!user.moodleUserId) {
      throw new BadRequestException('User does not have a Moodle user id.');
    }

    if (!role.moodleRoleId) {
      throw new BadRequestException(
        `Role ${role.name} does not have a Moodle role id configured.`,
      );
    }

    const existing = await this.enrollmentRepository.findOne({
      where: {
        course: { id: course.id },
        user: { id: user.id },
        role: { id: role.id },
      },
    });

    if (existing) {
      throw new ConflictException('User is already enrolled with this role.');
    }

    const moodleCourseId = Number(course.mcode);
    const moodleCourse = await this.moodleService.findCourseById(moodleCourseId);

    if (!moodleCourse) {
      throw new BadRequestException(
        `Moodle course id ${moodleCourseId} was not found. Update this course so it syncs with Moodle before enrolling users.`,
      );
    }

    await this.moodleService.enrollUser({
      userId: user.moodleUserId,
      courseId: moodleCourseId,
      roleId: role.moodleRoleId,
    });

    const enrollment = this.enrollmentRepository.create({
      course,
      user,
      role,
    });

    return this.enrollmentRepository.save(enrollment);
  }

  async enrollPublicUser(courseId: number, userId: number): Promise<CourseEnrollment> {
    const course = await this.findPublicCourse(courseId);
    return this.enrollPublicCourseUser(course, userId);
  }

  async enrollPublicUserBySlug(
    slug: string,
    userId: number,
  ): Promise<CourseEnrollment> {
    const course = await this.findPublicCourseBySlug(slug);
    return this.enrollPublicCourseUser(course, userId);
  }

  private async enrollPublicCourseUser(
    course: Course,
    userId: number,
  ): Promise<CourseEnrollment> {
    const role =
      (await this.roleRepository.findOneBy({ moodleRoleId: 5 })) ??
      (await this.roleRepository.findOneBy({ name: 'student' }));

    if (!role) {
      throw new BadRequestException(
        'Student role is not configured. Create a role with Moodle role id 5 before public enrollments.',
      );
    }

    return this.enrollUser(course.id, {
      userId,
      roleId: role.id,
    });
  }

  async unenrollUser(
    courseId: number,
    enrollmentId: number,
  ): Promise<{ message: string }> {
    await this.findOne(courseId);
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        id: enrollmentId,
        course: {
          id: courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with id ${enrollmentId} not found.`,
      );
    }

    if (
      enrollment.user.moodleUserId &&
      enrollment.course.mcode &&
      enrollment.role.moodleRoleId
    ) {
      await this.moodleService.unenrollUser({
        userId: enrollment.user.moodleUserId,
        courseId: Number(enrollment.course.mcode),
        roleId: enrollment.role.moodleRoleId,
      });
    }

    await this.enrollmentRepository.remove(enrollment);

    return { message: 'User unenrolled successfully.' };
  }
}
