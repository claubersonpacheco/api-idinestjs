import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideosTable1762300000000 implements MigrationInterface {
  name = 'CreateVideosTable1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "videos" (
        "id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "file_path" character varying(512),
        "name" character varying(255) NOT NULL,
        "guid" character varying(100),
        "videoLibraryId" character varying(100),
        "collection" character varying(255),
        "description" character varying(1000),
        "type" character varying(100),
        "thumbnail" character varying(512),
        "folder_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_videos_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_videos_name" UNIQUE ("name"),
        CONSTRAINT "FK_videos_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "videos"
    `);
  }
}
