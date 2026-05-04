import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  logo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streamLibraryId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streamApiKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streamUserApiKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  moodleToken: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  moodleUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bunnyStorageZoneName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bunnyStorageAccessKey: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  bunnyStorageCdnDomain: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  bunnyStorageBaseUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bunnyStorageUserFolder: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bunnyStorageVideoFolder: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bunnyStorageLogoFolder: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
