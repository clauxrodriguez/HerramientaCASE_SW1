import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await pool.query('SELECT * FROM diagrams ORDER BY id LIMIT 10;');
  console.log(`Diagrams rows: ${res.rowCount}`);
  console.table(res.rows);
  await pool.end();
}

main().catch(err => {
  console.error('Error querying diagrams:', err.message || err);
  process.exit(1);
});