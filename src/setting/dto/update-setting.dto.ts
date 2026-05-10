import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  logo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  streamLibraryId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  streamApiKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  streamUserApiKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  moodleToken?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  moodleUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  bunnyStorageZoneName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  bunnyStorageAccessKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  bunnyStorageCdnDomain?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  bunnyStorageBaseUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  bunnyStorageUserFolder?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  bunnyStorageVideoFolder?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  bunnyStorageLogoFolder?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  pixKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  pixMerchantName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  pixMerchantCity?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  pixCallbackSecret?: string;
}
