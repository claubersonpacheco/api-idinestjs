import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CourseService } from '../course/course.service';
import { PixCallbackDto } from '../course/dto/pix-callback.dto';
import { MailService } from '../mail/mail.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import {
  UserResponse,
  UserService,
  UserWithPassword,
} from '../user/user.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { PublicCourseRegisterDto } from './dto/public-course-register.dto';
import { PublicCourseLoginDto } from './dto/public-course-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthenticatedUser } from './types/authenticated-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
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
    enrollmentStatus?: string;
    enrollment?: unknown;
  }> {
    await this.courseService.findPublicCourse(courseId);

    const user = await this.userService.create({
      username: dto.username,
      name: dto.name,
      lastname: dto.lastname,
      email: dto.email,
      password: dto.password,
    });

    const enrollment = await this.courseService.enrollPublicUser(courseId, user.id, {
      paymentMethod: dto.paymentMethod,
      paymentTerm: dto.paymentTerm,
      installments: dto.installments,
    });

    const session = await this.login({
      identifier: dto.username,
      password: dto.password,
    });

    return { ...session, enrollmentStatus: enrollment.status, enrollment };
  }

  async registerForPublicCourseSlug(
    slug: string,
    dto: PublicCourseRegisterDto,
  ): Promise<{
    accessToken: string;
    user: UserResponse;
    enrollmentStatus?: string;
    enrollment?: unknown;
  }> {
    await this.courseService.findPublicCourseBySlug(slug);

    const user = await this.userService.create({
      username: dto.username,
      name: dto.name,
      lastname: dto.lastname,
      email: dto.email,
      password: dto.password,
    });

    const enrollment = await this.courseService.enrollPublicUserBySlug(slug, user.id, {
      paymentMethod: dto.paymentMethod,
      paymentTerm: dto.paymentTerm,
      installments: dto.installments,
    });

    const session = await this.login({
      identifier: dto.username,
      password: dto.password,
    });

    return { ...session, enrollmentStatus: enrollment.status, enrollment };
  }

  async loginForPublicCourseSlug(
    slug: string,
    loginDto: PublicCourseLoginDto,
  ): Promise<{
    accessToken: string;
    user: UserResponse;
    enrollmentStatus?: string;
    enrollment?: unknown;
  }> {
    await this.courseService.findPublicCourseBySlug(slug);
    const session = await this.login(loginDto);

    const enrollment = await this.courseService.enrollPublicUserBySlug(slug, session.user.id, {
      paymentMethod: loginDto.paymentMethod,
      paymentTerm: loginDto.paymentTerm,
      installments: loginDto.installments,
    }).catch(
      (error) => {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('already enrolled')) {
          return null;
        }

        throw error;
      },
    );

    return { ...session, enrollmentStatus: enrollment?.status, enrollment };
  }

  confirmPixPayment(dto: PixCallbackDto) {
    return this.courseService.confirmPixPayment(dto);
  }

  handleAsaasWebhook(dto: unknown, accessToken?: string) {
    return this.courseService.handleAsaasWebhook(dto as Parameters<CourseService['handleAsaasWebhook']>[0], accessToken);
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

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(forgotPasswordDto.email);

    if (!user) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date();
    resetPasswordExpires.setHours(resetPasswordExpires.getHours() + 1);

    await this.userService.updateResetToken(
      user.id,
      resetToken,
      resetPasswordExpires,
    );

    await this.mailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByResetToken(
      resetPasswordDto.token,
    );

    if (!user || !user.resetPasswordExpires) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    if (new Date() > user.resetPasswordExpires) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    await this.userService.updatePassword(user.id, resetPasswordDto.password);

    await this.userService.updateResetToken(user.id, null, null);

    return { message: 'Password has been reset successfully.' };
  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByIdWithPassword(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid current password.');
    }

    await this.userService.updatePassword(user.id, changePasswordDto.password);

    return { message: 'Password has been changed successfully.' };
  }

  private sanitizeUser(user: UserWithPassword): UserResponse {
    const { password, ...safeUser } = user;
    void password;

    return safeUser;
  }
}
