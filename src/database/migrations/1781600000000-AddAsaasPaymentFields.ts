import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAsaasPaymentFields1781600000000 implements MigrationInterface {
  name = 'AddAsaasPaymentFields1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "settings"
      ADD COLUMN IF NOT EXISTS "asaasApiKey" character varying(255),
      ADD COLUMN IF NOT EXISTS "asaasBaseUrl" character varying(512),
      ADD COLUMN IF NOT EXISTS "asaasWebhookToken" character varying(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      ADD COLUMN IF NOT EXISTS "asaas_customer_id" character varying(64),
      ADD COLUMN IF NOT EXISTS "asaas_payment_id" character varying(64),
      ADD COLUMN IF NOT EXISTS "asaas_invoice_url" character varying(512),
      ADD COLUMN IF NOT EXISTS "asaas_bank_slip_url" character varying(512),
      ADD COLUMN IF NOT EXISTS "asaas_payment_status" character varying(40),
      ADD COLUMN IF NOT EXISTS "asaas_webhook_payload" jsonb
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_course_enrollments_asaas_payment_id"
      ON "course_enrollments" ("asaas_payment_id")
      WHERE "asaas_payment_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_course_enrollments_asaas_payment_id"`);
    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      DROP COLUMN IF EXISTS "asaas_webhook_payload",
      DROP COLUMN IF EXISTS "asaas_payment_status",
      DROP COLUMN IF EXISTS "asaas_bank_slip_url",
      DROP COLUMN IF EXISTS "asaas_invoice_url",
      DROP COLUMN IF EXISTS "asaas_payment_id",
      DROP COLUMN IF EXISTS "asaas_customer_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "settings"
      DROP COLUMN IF EXISTS "asaasWebhookToken",
      DROP COLUMN IF EXISTS "asaasBaseUrl",
      DROP COLUMN IF EXISTS "asaasApiKey"
    `);
  }
}
