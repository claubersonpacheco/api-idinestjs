import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImprovePaymentMethods1781200000000 implements MigrationInterface {
  name = 'ImprovePaymentMethods1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "bank_transfer_details" text
    `);

    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      ADD COLUMN IF NOT EXISTS "paid_at" timestamp
    `);

    await queryRunner.query(`
      UPDATE "courses"
      SET "payment_methods" = replace("payment_methods", 'cash', 'cash_in_person')
      WHERE "payment_methods" LIKE '%cash%'
    `);

    await queryRunner.query(`
      UPDATE "course_enrollments"
      SET "payment_method" = 'cash_in_person'
      WHERE "payment_method" = 'cash'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "courses"
      SET "payment_methods" = replace("payment_methods", 'cash_in_person', 'cash')
      WHERE "payment_methods" LIKE '%cash_in_person%'
    `);

    await queryRunner.query(`
      UPDATE "course_enrollments"
      SET "payment_method" = 'cash'
      WHERE "payment_method" = 'cash_in_person'
    `);

    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      DROP COLUMN IF EXISTS "paid_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "courses"
      DROP COLUMN IF EXISTS "bank_transfer_details"
    `);
  }
}

