import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';
import {
  UserResponse,
  UserService,
  UserWithPassword,
} from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser } from './types/authenticated-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  register(createUserDto: CreateUserDto): Promise<UserResponse> {
    return this.userService.create(createUserDto);
  }

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    user: UserResponse;
  }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.sanitizeUser(user),
    };
  }

  me(userId: number): Promise<UserResponse> {
    return this.userService.findOne(userId);
  }

  private async validateUser(
    email: string,
    password: string,
  ): Promise<UserWithPassword> {
    const user = await this.userService.findByEmailWithPassword(email);

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
