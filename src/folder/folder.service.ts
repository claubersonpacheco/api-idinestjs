import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { Folder } from './folder.entity';

@Injectable()
export class FolderService {
  constructor(
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
  ) {}

  findAll(): Promise<Folder[]> {
    return this.folderRepository.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Folder> {
    const folder = await this.folderRepository.findOneBy({ id });
    if (!folder) {
      throw new NotFoundException(`Folder with id ${id} not found.`);
    }
    return folder;
  }

  async create(dto: CreateFolderDto): Promise<Folder> {
    const folder = this.folderRepository.create({ name: dto.name.trim() });
    return this.folderRepository.save(folder);
  }

  async update(id: number, dto: UpdateFolderDto): Promise<Folder> {
    const folder = await this.findOne(id);
    const updated = this.folderRepository.merge(folder, {
      ...(dto.name ? { name: dto.name.trim() } : {}),
    });
    return this.folderRepository.save(updated);
  }

  async remove(id: number): Promise<{ message: string }> {
    const folder = await this.findOne(id);
    await this.folderRepository.remove(folder);
    return { message: 'Folder deleted successfully.' };
  }
}
