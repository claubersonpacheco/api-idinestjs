import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MoodleService } from '../moodle/moodle.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly moodleService: MoodleService,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categoryRepository.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOneBy({ id });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found.`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const moodleCategory = await this.moodleService.createCategory({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      parent: dto.mcode,
    });

    const category = this.categoryRepository.create({
      name: dto.name.trim(),
      mcode: moodleCategory.id,
      description: dto.description?.trim() || null,
    });

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      await this.moodleService
        .deleteCategory(moodleCategory.id)
        .catch(() => undefined);
      throw error;
    }
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    const moodleCategoryId = category.mcode;

    if (moodleCategoryId) {
      await this.moodleService.updateCategory({
        id: moodleCategoryId,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
      });
    }

    const updated = this.categoryRepository.merge(category, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description?.trim() || null }
        : {}),
    });
    return this.categoryRepository.save(updated);
  }

  async remove(id: number): Promise<{ message: string }> {
    const category = await this.findOne(id);
    if (category.mcode) {
      await this.moodleService.deleteCategory(category.mcode);
    }
    await this.categoryRepository.remove(category);
    return { message: 'Category deleted successfully.' };
  }
}
