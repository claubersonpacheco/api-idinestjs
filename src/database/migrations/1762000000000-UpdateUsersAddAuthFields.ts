import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUsersAddAuthFields1762000000000 implements MigrationInterface 
{
  name = 'UpdateUsersAddAuthFields1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "username" character varying(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "lastname" character varying(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "suspended" character varying(1) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "moodle_user_id" integer
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "username" = COALESCE(NULLIF(split_part("email", '@', 1), ''), 'user_' || "id"::text)
      WHERE "username" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "username" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_users_username'
        ) THEN
          ALTER TABLE "users"
          ADD CONSTRAINT "UQ_users_username" UNIQUE ("username");
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT IF EXISTS "UQ_users_username"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "moodle_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "suspended"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "lastname"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "username"
    `);
  }
}
