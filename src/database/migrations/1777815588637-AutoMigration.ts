import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoMigration1777815588637 implements MigrationInterface {
  name = 'AutoMigration1777815588637';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Schema already covered by the previous hand-written migrations.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally empty: this migration only preserves the generated timestamp.
  }
}
