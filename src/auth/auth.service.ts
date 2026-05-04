import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CourseService } from '../course/course.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import {
  UserResponse,
  UserService,
  UserWithPassword,
} from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { PublicCourseRegisterDto } from './dto/public-course-register.dto';
import type { AuthenticatedUser } from './types/authenticated-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly jwtService: JwtService,
  ) {}

  register(createUserDto: CreateUserDto): Promise<UserResponse> {
    return this.userService.create(createUserDto);
  }

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    user: UserResponse;
  }> {
    const user = await this.validateUser(
      loginDto.identifier,
      loginDto.password,
    );
    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            permissions: user.role.permissions.map((permission) => ({
              id: permission.id,
              name: permission.name,
            })),
          }
        : null,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.sanitizeUser(user),
    };
  }

  me(userId: number): Promise<UserResponse> {
    return this.userService.findOne(userId);
  }

  async findPublicCourse(courseId: number) {
    return this.courseService.findPublicCourse(courseId);
  }

  async findPublicCourseBySlug(slug: string) {
    return this.courseService.findPublicCourseBySlug(slug);
  }

  async findPublicCourses() {
    return this.courseService.findPublicCourses();
  }

  async registerForPublicCourse(
    courseId: number,
    dto: PublicCourseRegisterDto,
  ): Promise<{
    accessToken: string;
    user: UserResponse;
  }> {
    await this.courseService.findPublicCourse(courseId);

    const user = await this.userService.create({
      username: dto.username,
      name: dto.name,
      lastname: dto.lastname,
      email: dto.email,
      password: dto.password,
      suspended: '0',
    });

    await this.courseService.enrollPublicUser(courseId, user.id);

    return this.login({
      identifier: dto.username,
      password: dto.password,
    });
  }

  async registerForPublicCourseSlug(
    slug: string,
    dto: PublicCourseRegisterDto,
  ): Promise<{
    accessToken: string;
    user: UserResponse;
  }> {
    await this.courseService.findPublicCourseBySlug(slug);

    const user = await this.userService.create({
      username: dto.username,
      name: dto.name,
      lastname: dto.lastname,
      email: dto.email,
      password: dto.password,
      suspended: '0',
    });

    await this.courseService.enrollPublicUserBySlug(slug, user.id);

    return this.login({
      identifier: dto.username,
      password: dto.password,
    });
  }

  private async validateUser(
    identifier: string,
    password: string,
  ): Promise<UserWithPassword> {
    const user = await this.userService.findByIdentifierWithPassword(
      identifier,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return user;
  }

  private sanitizeUser(user: UserWithPassword): UserResponse {
    const { password, ...safeUser } = user;
    void password;

    return safeUser;
  }
}
