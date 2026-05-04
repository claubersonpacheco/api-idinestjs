import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoriesAndCourses1762500000000
  implements MigrationInterface
{
  name = 'CreateCategoriesAndCourses1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" SERIAL NOT NULL,
        "name" character varying(255) NOT NULL,
        "mcode" integer,
        "description" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" SERIAL NOT NULL,
        "fullname" character varying(100) NOT NULL,
        "shortname" character varying(80) NOT NULL,
        "mcode" character varying(20),
        "summary" text,
        "visible" character varying(1),
        "startdate" TIMESTAMP,
        "enddate" TIMESTAMP,
        "category_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_courses_category_id'
        ) THEN
          ALTER TABLE "courses"
          ADD CONSTRAINT "FK_courses_category_id"
          FOREIGN KEY ("category_id") REFERENCES "categories"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "FK_courses_category_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "courses"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "categories"
    `);
  }
}
