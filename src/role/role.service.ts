import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from '../permission/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './role.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  findAll(): Promise<Role[]> {
    return this.roleRepository.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: {
        permissions: true,
      },
    });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found.`);
    }

    return role;
  }

  private async findPermissions(permissionIds?: number[]): Promise<Permission[]> {
    if (!permissionIds) {
      return [];
    }

    const permissions = await this.permissionRepository.findBy({
      id: In(permissionIds),
    });

    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions were not found.');
    }

    return permissions;
  }

  private async syncPermissions(
    role: Role,
    permissionIds: number[] | undefined,
  ): Promise<void> {
    if (permissionIds === undefined) {
      return;
    }

    const permissions = await this.findPermissions(permissionIds);
    const currentPermissionIds = role.permissions?.map((permission) => permission.id) ?? [];
    const nextPermissionIds = permissions.map((permission) => permission.id);

    const permissionsToAdd = nextPermissionIds.filter(
      (permissionId) => !currentPermissionIds.includes(permissionId),
    );
    const permissionsToRemove = currentPermissionIds.filter(
      (permissionId) => !nextPermissionIds.includes(permissionId),
    );

    if (!permissionsToAdd.length && !permissionsToRemove.length) {
      return;
    }

    await this.roleRepository
      .createQueryBuilder()
      .relation(Role, 'permissions')
      .of(role.id)
      .addAndRemove(permissionsToAdd, permissionsToRemove);
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const name = dto.name.trim();
    const existing = await this.roleRepository.findOneBy({ name });

    if (existing) {
      throw new ConflictException('A role with this name already exists.');
    }

    const role = this.roleRepository.create({
      name,
      description: dto.description?.trim() || null,
      moodleRoleId: dto.moodleRoleId ?? null,
    });

    const createdRole = await this.roleRepository.save(role);
    await this.syncPermissions(createdRole, dto.permissionIds);

    return this.findOne(createdRole.id);
  }

  async update(id: number, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const existing = await this.roleRepository.findOneBy({ name });

      if (existing && existing.id !== id) {
        throw new ConflictException('A role with this name already exists.');
      }
    }

    const updated = this.roleRepository.merge(role, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description?.trim() || null }
        : {}),
      ...(dto.moodleRoleId !== undefined
        ? { moodleRoleId: dto.moodleRoleId }
        : {}),
    });

    const savedRole = await this.roleRepository.save(updated);
    await this.syncPermissions(role, dto.permissionIds);

    return this.findOne(savedRole.id);
  }

  async remove(id: number): Promise<{ message: string }> {
    const role = await this.findOne(id);
    await this.roleRepository.remove(role);
    return { message: 'Role deleted successfully.' };
  }
}
