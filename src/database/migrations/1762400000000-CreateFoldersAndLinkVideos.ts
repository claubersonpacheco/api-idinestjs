import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFoldersAndLinkVideos1762400000000
  implements MigrationInterface
{
  name = 'CreateFoldersAndLinkVideos1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "folders" (
        "id" SERIAL NOT NULL,
        "name" character varying(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_folders_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "folders" ("id", "name")
      VALUES (1, 'Geral')
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      SELECT setval(
        pg_get_serial_sequence('"folders"', 'id'),
        GREATEST((SELECT COALESCE(MAX("id"), 1) FROM "folders"), 1),
        true
      )
    `);

    await queryRunner.query(`
      UPDATE "videos"
      SET "folder_id" = 1
      WHERE "folder_id" IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM "folders" f WHERE f."id" = "videos"."folder_id"
         )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_videos_folder_id'
        ) THEN
          ALTER TABLE "videos"
          ADD CONSTRAINT "FK_videos_folder_id"
          FOREIGN KEY ("folder_id") REFERENCES "folders"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      DROP CONSTRAINT IF EXISTS "FK_videos_folder_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "folders"
    `);
  }
}
