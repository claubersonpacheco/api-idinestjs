import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseImageUrl1781100000000 implements MigrationInterface {
  name = 'AddCourseImageUrl1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "image_url" character varying(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      DROP COLUMN IF EXISTS "image_url"
    `);
  }
}

