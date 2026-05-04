import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRolesAndPermissions1762600000000
  implements MigrationInterface
{
  name = 'CreateRolesAndPermissions1762600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permissions_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" character varying,
        "moodle_role_id" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_roles_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "role_id" integer NOT NULL,
        "permission_id" integer NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_role_permissions_role_id'
        ) THEN
          ALTER TABLE "role_permissions"
          ADD CONSTRAINT "FK_role_permissions_role_id"
          FOREIGN KEY ("role_id") REFERENCES "roles"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_role_permissions_permission_id'
        ) THEN
          ALTER TABLE "role_permissions"
          ADD CONSTRAINT "FK_role_permissions_permission_id"
          FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role_id" integer
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_users_role_id'
        ) THEN
          ALTER TABLE "users"
          ADD CONSTRAINT "FK_users_role_id"
          FOREIGN KEY ("role_id") REFERENCES "roles"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_role_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "role_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "role_permissions"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "roles"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "permissions"
    `);
  }
}
