import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { Folder } from './folder.entity';
import { FolderService } from './folder.service';

@Controller('folders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get()
  @RequirePermissions('folders.read')
  findAll(): Promise<Folder[]> {
    return this.folderService.findAll();
  }

  @Get(':id')
  @RequirePermissions('folders.read')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Folder> {
    return this.folderService.findOne(id);
  }

  @Post()
  @RequirePermissions('folders.create')
  create(@Body() dto: CreateFolderDto): Promise<Folder> {
    return this.folderService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('folders.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFolderDto,
  ): Promise<Folder> {
    return this.folderService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('folders.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.folderService.remove(id);
  }
}
