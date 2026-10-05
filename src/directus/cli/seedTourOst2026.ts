import pg from 'pg';
import { seedTourOst2026 } from '../migrations/fixtures/seedTourOst2026.js';

const client = new pg.Client({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

async function main(): Promise<void> {
  try {
    await client.connect();
    await client.query('BEGIN');
    await seedTourOst2026(async (sql: string, values: unknown[] = []) => {
      let index = 0;
      const parameterizedSql = sql.replace(/\?/g, () => `$${++index}`);
      const result = await client.query(parameterizedSql, values);
      return result.rows;
    });
    await client.query('COMMIT');
    console.info('Tour Ost 2026 fixture imported');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Tour Ost 2026 fixture import failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
