import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPixPaymentFields1781300000000 implements MigrationInterface {
  name = 'AddPixPaymentFields1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "settings"
      ADD COLUMN IF NOT EXISTS "pixKey" character varying(255),
      ADD COLUMN IF NOT EXISTS "pixMerchantName" character varying(255),
      ADD COLUMN IF NOT EXISTS "pixMerchantCity" character varying(255),
      ADD COLUMN IF NOT EXISTS "pixCallbackSecret" character varying(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      ADD COLUMN IF NOT EXISTS "pix_txid" character varying(35),
      ADD COLUMN IF NOT EXISTS "pix_copy_paste" text,
      ADD COLUMN IF NOT EXISTS "pix_expires_at" timestamp,
      ADD COLUMN IF NOT EXISTS "pix_callback_payload" jsonb
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_course_enrollments_pix_txid"
      ON "course_enrollments" ("pix_txid")
      WHERE "pix_txid" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_course_enrollments_pix_txid"`);
    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      DROP COLUMN IF EXISTS "pix_callback_payload",
      DROP COLUMN IF EXISTS "pix_expires_at",
      DROP COLUMN IF EXISTS "pix_copy_paste",
      DROP COLUMN IF EXISTS "pix_txid"
    `);

    await queryRunner.query(`
      ALTER TABLE "settings"
      DROP COLUMN IF EXISTS "pixCallbackSecret",
      DROP COLUMN IF EXISTS "pixMerchantCity",
      DROP COLUMN IF EXISTS "pixMerchantName",
      DROP COLUMN IF EXISTS "pixKey"
    `);
  }
}
