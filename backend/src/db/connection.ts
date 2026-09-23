import { Pool } from 'pg';

let pool: Pool | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Create tables if they don't exist
    await createTables(client);
    
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function createTables(client: any): Promise<void> {
  const createTablesQuery = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Diagrams table
    CREATE TABLE IF NOT EXISTS diagrams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      package VARCHAR(255) NOT NULL,
      diagram_json JSONB NOT NULL,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Diagram collaborators table
    CREATE TABLE IF NOT EXISTS diagram_collaborators (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(50) DEFAULT 'collaborator',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(diagram_id, user_id)
    );

    -- Sessions table (for collaboration)
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      socket_id VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Locks table (for collaboration)
    CREATE TABLE IF NOT EXISTS locks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
      element_id VARCHAR(255) NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes')
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_diagrams_owner_id ON diagrams(owner_id);
    CREATE INDEX IF NOT EXISTS idx_diagram_collaborators_diagram_id ON diagram_collaborators(diagram_id);
    CREATE INDEX IF NOT EXISTS idx_diagram_collaborators_user_id ON diagram_collaborators(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_diagram_id ON sessions(diagram_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_locks_diagram_id ON locks(diagram_id);
    CREATE INDEX IF NOT EXISTS idx_locks_element_id ON locks(element_id);
    CREATE INDEX IF NOT EXISTS idx_locks_expires_at ON locks(expires_at);
  `;

  await client.query(createTablesQuery);
  console.log('✅ Database tables created/verified');
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database connection closed');
  }
}

