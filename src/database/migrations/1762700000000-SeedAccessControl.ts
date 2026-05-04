import { MigrationInterface, QueryRunner } from 'typeorm';

const permissions = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'permissions.read',
  'permissions.create',
  'permissions.update',
  'permissions.delete',
  'settings.read',
  'settings.create',
  'settings.update',
  'settings.delete',
  'videos.read',
  'videos.create',
  'videos.update',
  'videos.delete',
  'folders.read',
  'folders.create',
  'folders.update',
  'folders.delete',
  'categories.read',
  'categories.create',
  'categories.update',
  'categories.delete',
  'courses.read',
  'courses.create',
  'courses.update',
  'courses.delete',
];

export class SeedAccessControl1762700000000 implements MigrationInterface {
  name = 'SeedAccessControl1762700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of permissions) {
      await queryRunner.query(
        `
          INSERT INTO "permissions" ("name", "description")
          VALUES ($1, $2)
          ON CONFLICT ("name") DO NOTHING
        `,
        [permission, permission],
      );
    }

    await queryRunner.query(`
      INSERT INTO "roles" ("name", "description")
      VALUES ('master', 'Acesso total ao sistema')
      ON CONFLICT ("name") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" = 'master'
      ON CONFLICT ("role_id", "permission_id") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'master')
      WHERE "id" = (
        SELECT "id" FROM "users" WHERE "role_id" IS NULL ORDER BY "id" ASC LIMIT 1
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "role_id" = NULL
      WHERE "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'master')
    `);

    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'master')
    `);

    await queryRunner.query(`
      DELETE FROM "roles" WHERE "name" = 'master'
    `);

    await queryRunner.query(
      `
        DELETE FROM "permissions"
        WHERE "name" = ANY($1)
      `,
      [permissions],
    );
  }
}
