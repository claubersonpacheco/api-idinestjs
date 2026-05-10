import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { QueryFailedError, Repository } from 'typeorm';
import { MoodleService } from '../moodle/moodle.service';
import { Role } from '../role/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

export type UserResponse = Omit<User, 'password'>;
export type UserWithPassword = User;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly moodleService: MoodleService,
  ) {}

  private sanitizeUser(user: User): UserResponse {
    const { password, ...safeUser } = user;
    void password;

    return safeUser;
  }

  async findAll(): Promise<UserResponse[]> {
    const users = await this.userRepository.find({
      order: {
        id: 'ASC',
      },
    });

    return users.map((user) => this.sanitizeUser(user));
  }

  async findOne(id: number): Promise<UserResponse> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found.`);
    }

    return this.sanitizeUser(user);
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponse> {
    const normalizedEmail = createUserDto.email.trim().toLowerCase();
    const normalizedUsername = createUserDto.username.trim();
    const { roleId, ...userPayload } = createUserDto;

    const existingUser = await this.userRepository.findOneBy({
      email: normalizedEmail,
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const existingUsername = await this.userRepository.findOneBy({
      username: normalizedUsername,
    });

    if (existingUsername) {
      throw new ConflictException('A user with this username already exists.');
    }

    const role = roleId ? await this.roleRepository.findOneBy({ id: roleId }) : null;

    if (roleId && !role) {
      throw new NotFoundException(`Role with id ${roleId} not found.`);
    }

    const moodleUser = await this.moodleService.createUser({
      username: normalizedUsername,
      password: createUserDto.password,
      firstname: createUserDto.name.trim(),
      lastname: createUserDto.lastname?.trim() || createUserDto.name.trim(),
      email: normalizedEmail,
    });

    let createdUser: User;

    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const user = this.userRepository.create({
        ...userPayload,
        email: normalizedEmail,
        username: normalizedUsername,
        moodleUserId: moodleUser.id,
        password: hashedPassword,
        role,
      });

      createdUser = await this.userRepository.save(user);
    } catch (error) {
      await this.moodleService.deleteUser(moodleUser.id).catch(() => undefined);
      throw error;
    }

    return this.sanitizeUser(createdUser);
  }

  async findByIdentifierWithPassword(
    identifier: string,
  ): Promise<UserWithPassword | null> {
    const normalizedIdentifier = identifier.trim();

    return this.userRepository.findOne({
      where: [
        { email: normalizedIdentifier.toLowerCase() },
        { username: normalizedIdentifier },
      ],
      select: {
        id: true,
        username: true,
        name: true,
        lastname: true,
        email: true,
        suspended: true,
        moodleUserId: true,
        password: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByIdWithPassword(userId: number): Promise<UserWithPassword | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        lastname: true,
        email: true,
        suspended: true,
        moodleUserId: true,
        password: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { resetPasswordToken: token },
      select: {
        id: true,
        username: true,
        name: true,
        lastname: true,
        email: true,
        suspended: true,
        moodleUserId: true,
        password: true,
        role: true,
        resetPasswordToken: true,
        resetPasswordExpires: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateResetToken(
    userId: number,
    resetPasswordToken: string | null,
    resetPasswordExpires: Date | null,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      resetPasswordToken,
      resetPasswordExpires,
    });
  }

  async updatePassword(userId: number, password: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        lastname: true,
        email: true,
        moodleUserId: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found.`);
    }

    let moodleUserId = user.moodleUserId;

    if (!moodleUserId) {
      const moodleUser =
        (await this.moodleService.findUserByField('email', user.email).catch(
          () => null,
        )) ??
        (await this.moodleService.findUserByField('username', user.username).catch(
          () => null,
        ));

      if (moodleUser?.id) {
        moodleUserId = moodleUser.id;
        await this.userRepository.update(user.id, { moodleUserId });
      }
    }

    if (moodleUserId) {
      await this.moodleService.updateUser({
        id: moodleUserId,
        username: user.username,
        password,
        firstname: user.name,
        lastname: user.lastname || user.name,
        email: user.email,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userRepository.update(userId, { password: hashedPassword });
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        lastname: true,
        email: true,
        suspended: true,
        moodleUserId: true,
        password: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found.`);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const normalizedEmail = updateUserDto.email.trim().toLowerCase();
      const existingUser = await this.userRepository.findOneBy({
        email: normalizedEmail,
      });

      if (existingUser) {
        throw new ConflictException('A user with this email already exists.');
      }

      updateUserDto.email = normalizedEmail;
    }

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const normalizedUsername = updateUserDto.username.trim();
      const existingUsername = await this.userRepository.findOneBy({
        username: normalizedUsername,
      });

      if (existingUsername) {
        throw new ConflictException('A user with this username already exists.');
      }

      updateUserDto.username = normalizedUsername;
    }

    const { roleId, ...payload } = updateUserDto;

    if (updateUserDto.password) {
      payload.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const role =
      roleId !== undefined && roleId !== null
        ? await this.roleRepository.findOneBy({ id: roleId })
        : roleId === null
          ? null
          : undefined;

    if (roleId !== undefined && roleId !== null && !role) {
      throw new NotFoundException(`Role with id ${roleId} not found.`);
    }

    if (user.moodleUserId) {
      await this.moodleService.updateUser({
        id: user.moodleUserId,
        ...(payload.username !== undefined ? { username: payload.username } : {}),
        ...(updateUserDto.password !== undefined
          ? { password: updateUserDto.password }
          : {}),
        ...(payload.name !== undefined ? { firstname: payload.name } : {}),
        ...(payload.lastname !== undefined ? { lastname: payload.lastname } : {}),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.suspended !== undefined
          ? { suspended: payload.suspended === '1' }
          : {}),
      });
    }

    const updatedUser = this.userRepository.merge(user, {
      ...payload,
      ...(roleId !== undefined ? { role } : {}),
    });

    const savedUser = await this.userRepository.save(updatedUser);

    return this.sanitizeUser(savedUser);
  }

  async remove(id: number): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        lastname: true,
        email: true,
        suspended: true,
        moodleUserId: true,
        password: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found.`);
    }

    try {
      await this.userRepository.remove(user);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string };

        if (driverError.code === '23503') {
          throw new ConflictException(
            'Nao foi possivel excluir este usuario porque existem registros vinculados a ele.',
          );
        }
      }

      throw error;
    }

    if (user.moodleUserId) {
      await this.moodleService.deleteUser(user.moodleUserId).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `User ${user.id} was deleted locally, but Moodle user ${user.moodleUserId} could not be deleted: ${message}`,
        );
      });
    }

    return {
      message: 'User deleted successfully.',
    };
  }
}
