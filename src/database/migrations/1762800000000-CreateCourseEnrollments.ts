import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseEnrollments1762800000000
  implements MigrationInterface
{
  name = 'CreateCourseEnrollments1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_enrollments" (
        "id" SERIAL NOT NULL,
        "course_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "role_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_enrollments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_enrollments_course_user_role" UNIQUE ("course_id", "user_id", "role_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_course_enrollments_course_id'
        ) THEN
          ALTER TABLE "course_enrollments"
          ADD CONSTRAINT "FK_course_enrollments_course_id"
          FOREIGN KEY ("course_id") REFERENCES "courses"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_course_enrollments_user_id'
        ) THEN
          ALTER TABLE "course_enrollments"
          ADD CONSTRAINT "FK_course_enrollments_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_course_enrollments_role_id'
        ) THEN
          ALTER TABLE "course_enrollments"
          ADD CONSTRAINT "FK_course_enrollments_role_id"
          FOREIGN KEY ("role_id") REFERENCES "roles"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_enrollments" DROP CONSTRAINT IF EXISTS "FK_course_enrollments_role_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "course_enrollments" DROP CONSTRAINT IF EXISTS "FK_course_enrollments_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "course_enrollments" DROP CONSTRAINT IF EXISTS "FK_course_enrollments_course_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "course_enrollments"
    `);
  }
}
