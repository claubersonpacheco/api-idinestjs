import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseCommercialFields1781000000000 implements MigrationInterface {
  name = 'AddCourseCommercialFields1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "access_type" character varying(20) NOT NULL DEFAULT 'private',
      ADD COLUMN IF NOT EXISTS "pricing_type" character varying(20) NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS "price" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "currency" character varying(3) NOT NULL DEFAULT 'BRL',
      ADD COLUMN IF NOT EXISTS "capacity_type" character varying(20) NOT NULL DEFAULT 'unlimited',
      ADD COLUMN IF NOT EXISTS "capacity_limit" integer,
      ADD COLUMN IF NOT EXISTS "payment_methods" text,
      ADD COLUMN IF NOT EXISTS "payment_terms" character varying(20) NOT NULL DEFAULT 'cash',
      ADD COLUMN IF NOT EXISTS "max_installments" integer
    `);

    await queryRunner.query(`
      UPDATE "courses"
      SET "access_type" = CASE WHEN "is_public" = true THEN 'open' ELSE 'private' END
      WHERE "access_type" IS NULL OR "access_type" = 'private'
    `);

    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      ADD COLUMN IF NOT EXISTS "status" character varying(30) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS "payment_method" character varying(20),
      ADD COLUMN IF NOT EXISTS "payment_term" character varying(20),
      ADD COLUMN IF NOT EXISTS "installments" integer,
      ADD COLUMN IF NOT EXISTS "amount_due" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      DROP COLUMN IF EXISTS "amount_due",
      DROP COLUMN IF EXISTS "installments",
      DROP COLUMN IF EXISTS "payment_term",
      DROP COLUMN IF EXISTS "payment_method",
      DROP COLUMN IF EXISTS "status"
    `);

    await queryRunner.query(`
      ALTER TABLE "courses"
      DROP COLUMN IF EXISTS "max_installments",
      DROP COLUMN IF EXISTS "payment_terms",
      DROP COLUMN IF EXISTS "payment_methods",
      DROP COLUMN IF EXISTS "capacity_limit",
      DROP COLUMN IF EXISTS "capacity_type",
      DROP COLUMN IF EXISTS "currency",
      DROP COLUMN IF EXISTS "price",
      DROP COLUMN IF EXISTS "pricing_type",
      DROP COLUMN IF EXISTS "access_type"
    `);
  }
}

