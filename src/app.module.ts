import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { CourseModule } from './course/course.module';
import { typeOrmConfig } from './database/typeorm.config';
import { FolderModule } from './folder/folder.module';
import { PermissionModule } from './permission/permission.module';
import { RoleModule } from './role/role.module';
import { VideoModule } from './video/video.module';
import { UserModule } from './user/user.module';
import { SettingModule } from './setting/setting.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      ...typeOrmConfig,
      autoLoadEntities: true,
    }),
    AuthModule,
    CategoryModule,
    CourseModule,
    FolderModule,
    VideoModule,
    UserModule,
    SettingModule,
    PermissionModule,
    RoleModule,
  ],
})
export class AppModule {}
