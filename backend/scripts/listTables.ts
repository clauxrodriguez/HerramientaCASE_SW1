import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config(); // carga .env en la raíz de /server

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;");
  console.log('Public tables:');
  for (const row of res.rows) {
    console.log('-', row.tablename);
  }
  await pool.end();
}

main().catch(err => {
  console.error('Error querying database:', err.message || err);
  process.exit(1);
});