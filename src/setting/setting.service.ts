import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { Setting } from './setting.entity';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  findAll(): Promise<Setting[]> {
    return this.settingRepository.find({
      order: {
        id: 'ASC',
      },
    });
  }

  private isUrl(value?: string): boolean {
    return Boolean(value && /^https?:\/\/\S+$/.test(value));
  }

  private normalizeMoodleFields<T extends CreateSettingDto | UpdateSettingDto>(
    dto: T,
  ): T {
    const normalizedDto = { ...dto };

    if (
      normalizedDto.moodleUrl &&
      normalizedDto.moodleToken &&
      !this.isUrl(normalizedDto.moodleUrl) &&
      this.isUrl(normalizedDto.moodleToken)
    ) {
      const moodleUrl = normalizedDto.moodleToken;
      normalizedDto.moodleToken = normalizedDto.moodleUrl;
      normalizedDto.moodleUrl = moodleUrl;
    }

    if (normalizedDto.moodleUrl && !this.isUrl(normalizedDto.moodleUrl)) {
      throw new BadRequestException(
        'moodleUrl must be a valid URL starting with http:// or https://',
      );
    }

    return normalizedDto;
  }

  async findOne(id: number): Promise<Setting> {
    const setting = await this.settingRepository.findOneBy({ id });

    if (!setting) {
      throw new NotFoundException(`Setting with id ${id} not found.`);
    }

    return setting;
  }

  async create(createSettingDto: CreateSettingDto): Promise<Setting> {
    const setting = this.settingRepository.create(
      this.normalizeMoodleFields(createSettingDto),
    );
    return this.settingRepository.save(setting);
  }

  async update(id: number, updateSettingDto: UpdateSettingDto): Promise<Setting> {
    const setting = await this.findOne(id);
    const updatedSetting = this.settingRepository.merge(
      setting,
      this.normalizeMoodleFields(updateSettingDto),
    );
    return this.settingRepository.save(updatedSetting);
  }

  async remove(id: number): Promise<{ message: string }> {
    const setting = await this.findOne(id);
    await this.settingRepository.remove(setting);

    return {
      message: 'Setting deleted successfully.',
    };
  }
}
