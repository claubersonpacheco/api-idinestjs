import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { Folder } from '../folder/folder.entity';
import { Setting } from '../setting/setting.entity';
import { User } from '../user/user.entity';
import { CompleteVideoUploadDto } from './dto/complete-video-upload.dto';
import { CreateVideoUploadDto } from './dto/create-video-upload.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { Video } from './video.entity';

type BunnyCreateVideoResponse = {
  guid: string;
};

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
  ) {}

  findAll(): Promise<Video[]> {
    return this.videoRepository.find({
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Video> {
    const video = await this.videoRepository.findOneBy({ id });
    if (!video) {
      throw new NotFoundException(`Video with id ${id} not found.`);
    }

    return video;
  }

  private async getStreamConfig(): Promise<{
    libraryId: string;
    apiKey: string;
  }> {
    const [setting] = await this.settingRepository.find({
      take: 1,
      order: { id: 'ASC' },
    });

    const libraryId = setting?.streamLibraryId?.trim();
    const apiKey = setting?.streamApiKey?.trim();

    if (!libraryId || !apiKey) {
      throw new BadRequestException(
        'Configure streamLibraryId e streamApiKey em settings antes de enviar videos.',
      );
    }

    return { libraryId, apiKey };
  }

  private async createBunnyVideo(
    libraryId: string,
    apiKey: string,
    title: string,
    collection?: string,
  ): Promise<BunnyCreateVideoResponse> {
    try {
      const response = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos`,
        {
          method: 'POST',
          headers: {
            AccessKey: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            ...(collection?.trim() ? { collectionId: collection.trim() } : {}),
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;
      const guid = typeof payload?.guid === 'string' ? payload.guid : null;
      const message = typeof payload?.message === 'string' ? payload.message : null;

      if (!response.ok || !guid) {
        throw new BadRequestException(
          message ?? 'Falha ao criar video no Bunny Stream.',
        );
      }

      return { guid };
    } catch (error) {
      if (error instanceof HttpException) {
        this.logger.warn(
          `Bunny create video rejected. libraryId=${libraryId}, title="${title}", status=${error.getStatus()}`,
        );
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Bunny communication failure while creating video. libraryId=${libraryId}, title="${title}", error=${errorMessage}`,
      );
      throw new BadGatewayException(
        'Nao foi possivel comunicar com Bunny Stream. Verifique streamLibraryId, streamApiKey e conectividade.',
      );
    }
  }

  async initUpload(userId: number, dto: CreateVideoUploadDto): Promise<{
    video: Video;
    tus: {
      endpoint: string;
      authorizationSignature: string;
      authorizationExpire: number;
      libraryId: string;
      videoId: string;
    };
  }> {
    try {
      const existingVideo = await this.videoRepository.findOneBy({
        name: dto.name.trim(),
      });
      if (existingVideo) {
        throw new ConflictException('Ja existe um video com este nome.');
      }

      const user = await this.userRepository.findOneBy({ id: userId });
      if (!user) {
        throw new NotFoundException(`User with id ${userId} not found.`);
      }

      const { libraryId, apiKey } = await this.getStreamConfig();
      const folder = await this.folderRepository.findOneBy({ id: dto.folderId });
      if (!folder) {
        throw new NotFoundException(`Folder with id ${dto.folderId} not found.`);
      }

      const bunnyVideo = await this.createBunnyVideo(
        libraryId,
        apiKey,
        dto.name.trim(),
        dto.collection,
      );

      const video = this.videoRepository.create({
        user,
        name: dto.name.trim(),
        filePath: dto.filePath?.trim() || null,
        collection: dto.collection?.trim() || null,
        description: dto.description?.trim() || null,
        type: dto.type?.trim() || null,
        thumbnail: dto.thumbnail?.trim() || null,
        folder,
        guid: bunnyVideo.guid,
        videoLibraryId: libraryId,
      });

      const savedVideo = await this.videoRepository.save(video);

      const authorizationExpire = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
      const signaturePayload = `${libraryId}${apiKey}${authorizationExpire}${bunnyVideo.guid}`;
      const authorizationSignature = createHash('sha256')
        .update(signaturePayload)
        .digest('hex');

      return {
        video: savedVideo,
        tus: {
          endpoint: 'https://video.bunnycdn.com/tusupload',
          authorizationSignature,
          authorizationExpire,
          libraryId,
          videoId: bunnyVideo.guid,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        this.logger.warn(
          `Init upload rejected. userId=${userId}, videoName="${dto.name}", status=${error.getStatus()}`,
        );
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Unexpected init upload failure. userId=${userId}, videoName="${dto.name}", folderId=${dto.folderId}, error=${errorMessage}`,
      );
      throw new InternalServerErrorException(
        'Falha ao iniciar upload de video. Revise logs do servidor para detalhes.',
      );
    }
  }

  async completeUpload(
    id: number,
    dto: CompleteVideoUploadDto,
  ): Promise<Video> {
    const video = await this.findOne(id);
    const updated = this.videoRepository.merge(video, {
      guid: dto.guid?.trim() || video.guid,
      videoLibraryId: dto.videoLibraryId?.trim() || video.videoLibraryId,
    });

    return this.videoRepository.save(updated);
  }

  async update(id: number, dto: UpdateVideoDto): Promise<Video> {
    const video = await this.findOne(id);

    if (dto.name && dto.name.trim() !== video.name) {
      const existing = await this.videoRepository.findOneBy({ name: dto.name.trim() });
      if (existing) {
        throw new ConflictException('Ja existe um video com este nome.');
      }

      video.name = dto.name.trim();
    }

    if (dto.folderId && dto.folderId !== video.folder.id) {
      const folder = await this.folderRepository.findOneBy({ id: dto.folderId });
      if (!folder) {
        throw new NotFoundException(`Folder with id ${dto.folderId} not found.`);
      }

      video.folder = folder;
    }

    return this.videoRepository.save(video);
  }

  async remove(id: number): Promise<{ message: string }> {
    const video = await this.findOne(id);
    await this.videoRepository.remove(video);
    return { message: 'Video deleted successfully.' };
  }
}
