import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedEmailUpdatePermission1780000000000
  implements MigrationInterface
{
  name = 'SeedEmailUpdatePermission1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO "permissions" ("name", "description")
        VALUES ($1, $2)
        ON CONFLICT ("name") DO NOTHING
      `,
      ['user.email', 'Permite alterar e-mail de usuario'],
    );

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" = 'master'
        AND p."name" = 'user.email'
      ON CONFLICT ("role_id", "permission_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "permission_id" = (
        SELECT "id" FROM "permissions" WHERE "name" = 'user.email'
      )
    `);

    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "name" = 'user.email'
    `);
  }
}
