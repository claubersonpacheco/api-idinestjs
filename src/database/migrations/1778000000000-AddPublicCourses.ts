import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicCourses1778000000000 implements MigrationInterface {
  name = 'AddPublicCourses1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      DROP COLUMN IF EXISTS "is_public"
    `);
  }
}
