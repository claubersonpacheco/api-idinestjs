import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettingsTable1762200000000 implements MigrationInterface {
  name = 'CreateSettingsTable1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" SERIAL NOT NULL,
        "name" character varying(255),
        "logo" character varying(512),
        "streamLibraryId" character varying(255),
        "streamApiKey" character varying(255),
        "streamUserApiKey" character varying(255),
        "moodleToken" character varying(255),
        "moodleUrl" character varying(255),
        "bunnyStorageZoneName" character varying(255),
        "bunnyStorageAccessKey" character varying(255),
        "bunnyStorageCdnDomain" character varying(512),
        "bunnyStorageBaseUrl" character varying(512),
        "bunnyStorageUserFolder" character varying(255),
        "bunnyStorageVideoFolder" character varying(255),
        "bunnyStorageLogoFolder" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settings_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "settings"
    `);
  }
}
