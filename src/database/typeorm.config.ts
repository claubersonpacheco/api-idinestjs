import { config as loadEnv } from 'dotenv';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { User } from '../user/user.entity';

loadEnv();

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number(value);

  return Number.isNaN(parsedValue) ? fallback : parsedValue;
};

export const typeOrmConfig: PostgresConnectionOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST ?? 'localhost',
  port: parsePort(process.env.DB_PORT, 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '123456',
  database: process.env.DB_DATABASE ?? 'idi',
  entities: [User],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: (process.env.DB_SYNCHRONIZE ?? 'false') === 'true',
};
