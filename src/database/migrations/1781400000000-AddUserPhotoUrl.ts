import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPhotoUrl1781400000000 implements MigrationInterface {
  name = 'AddUserPhotoUrl1781400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "photo_url" character varying(512)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "photo_url"
    `);
  }
}
