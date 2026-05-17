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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { Setting } from './setting.entity';
import { SettingService } from './setting.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  @RequirePermissions('settings.read')
  findAll(): Promise<Setting[]> {
    return this.settingService.findAll();
  }

  @Get(':id')
  @RequirePermissions('settings.read')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Setting> {
    return this.settingService.findOne(id);
  }

  @Post()
  @RequirePermissions('settings.create')
  create(@Body() createSettingDto: CreateSettingDto): Promise<Setting> {
    return this.settingService.create(createSettingDto);
  }

  @Patch(':id')
  @RequirePermissions('settings.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSettingDto: UpdateSettingDto,
  ): Promise<Setting> {
    return this.settingService.update(id, updateSettingDto);
  }

  @Post(':id/logo')
  @RequirePermissions('settings.update')
  @UseInterceptors(FileInterceptor('logo'))
  uploadLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedImageFile,
  ): Promise<Setting> {
    return this.settingService.uploadLogo(id, file);
  }

  @Delete(':id')
  @RequirePermissions('settings.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.settingService.remove(id);
  }
}
