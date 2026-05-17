import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSettingLogoVariants1781500000000 implements MigrationInterface {
  name = 'AddSettingLogoVariants1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "settings"
      ADD COLUMN IF NOT EXISTS "logoIcon" character varying(512),
      ADD COLUMN IF NOT EXISTS "logoPrint" character varying(512),
      ADD COLUMN IF NOT EXISTS "logoWhite" character varying(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "settings"
      DROP COLUMN IF EXISTS "logoWhite",
      DROP COLUMN IF EXISTS "logoPrint",
      DROP COLUMN IF EXISTS "logoIcon"
    `);
  }
}
