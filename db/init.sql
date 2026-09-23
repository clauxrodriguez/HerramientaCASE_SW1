-- Initialize the UML Tool database
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a dedicated schema for the UML tool
CREATE SCHEMA IF NOT EXISTS uml_tool;

-- Set search path to include the UML tool schema
SET search_path TO uml_tool, public;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- For future authentication
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Diagrams table
CREATE TABLE IF NOT EXISTS diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    package VARCHAR(255) NOT NULL DEFAULT 'com.example',
    diagram_json JSONB NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    is_template BOOLEAN DEFAULT false,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Diagram collaborators table
CREATE TABLE IF NOT EXISTS diagram_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'collaborator' CHECK (role IN ('owner', 'editor', 'viewer')),
    permissions JSONB DEFAULT '{"canEdit": true, "canDelete": false, "canShare": false}',
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(diagram_id, user_id)
);

-- Sessions table (for real-time collaboration)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    socket_id VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip_address INET,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Locks table (for collaboration conflict resolution)
CREATE TABLE IF NOT EXISTS locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    element_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    lock_type VARCHAR(50) DEFAULT 'edit' CHECK (lock_type IN ('edit', 'view')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes')
);

-- Generated projects table (track generated Spring Boot projects)
CREATE TABLE IF NOT EXISTS generated_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_name VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    spring_boot_version VARCHAR(50) DEFAULT '3.2.0',
    java_version VARCHAR(50) DEFAULT '17',
    file_path TEXT,
    file_size BIGINT,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI suggestions table (store AI-generated suggestions)
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    suggestion_data JSONB NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    is_applied BOOLEAN DEFAULT false,
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_diagrams_owner_id ON diagrams(owner_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_created_at ON diagrams(created_at);
CREATE INDEX IF NOT EXISTS idx_diagrams_is_public ON diagrams(is_public);
CREATE INDEX IF NOT EXISTS idx_diagrams_package ON diagrams(package);

CREATE INDEX IF NOT EXISTS idx_diagram_collaborators_diagram_id ON diagram_collaborators(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_collaborators_user_id ON diagram_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_diagram_collaborators_role ON diagram_collaborators(role);

CREATE INDEX IF NOT EXISTS idx_sessions_diagram_id ON sessions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_locks_diagram_id ON locks(diagram_id);
CREATE INDEX IF NOT EXISTS idx_locks_element_id ON locks(element_id);
CREATE INDEX IF NOT EXISTS idx_locks_user_id ON locks(user_id);
CREATE INDEX IF NOT EXISTS idx_locks_expires_at ON locks(expires_at);

CREATE INDEX IF NOT EXISTS idx_generated_projects_diagram_id ON generated_projects(diagram_id);
CREATE INDEX IF NOT EXISTS idx_generated_projects_user_id ON generated_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_projects_created_at ON generated_projects(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_diagram_id ON ai_suggestions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_id ON ai_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_priority ON ai_suggestions(priority);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diagrams_updated_at BEFORE UPDATE ON diagrams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM locks WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up inactive sessions
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions 
    WHERE is_active = false 
    AND last_activity < CURRENT_TIMESTAMP - INTERVAL '1 hour';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for development
INSERT INTO users (username, email, first_name, last_name) VALUES
    ('admin', 'admin@umltool.com', 'Admin', 'User'),
    ('developer', 'dev@umltool.com', 'Developer', 'User')
ON CONFLICT (username) DO NOTHING;

-- Insert sample diagram
INSERT INTO diagrams (name, description, package, diagram_json, owner_id, is_public) 
SELECT 
    'Sample E-commerce Diagram',
    'A sample UML diagram for an e-commerce system',
    'com.ecommerce',
    '{
        "package": "com.ecommerce",
        "classes": [
            {
                "name": "User",
                "attributes": [
                    {"name": "id", "type": "Long", "isId": true},
                    {"name": "username", "type": "String", "nullable": false},
                    {"name": "email", "type": "String", "unique": true}
                ],
                "methods": [
                    {"name": "save", "returnType": "void", "parameters": []},
                    {"name": "findByEmail", "returnType": "User", "parameters": [{"name": "email", "type": "String"}]}
                ],
                "relations": [
                    {"type": "ONE_TO_MANY", "target": "Order", "mappedBy": "user"}
                ]
            },
            {
                "name": "Order",
                "attributes": [
                    {"name": "id", "type": "Long", "isId": true},
                    {"name": "orderDate", "type": "LocalDateTime", "nullable": false},
                    {"name": "total", "type": "BigDecimal", "nullable": false}
                ],
                "methods": [
                    {"name": "calculateTotal", "returnType": "BigDecimal", "parameters": []}
                ],
                "relations": [
                    {"type": "MANY_TO_ONE", "target": "User", "joinColumn": "user_id"}
                ]
            }
        ]
    }'::jsonb,
    u.id,
    true
FROM users u 
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;

-- Create a view for diagram statistics
CREATE OR REPLACE VIEW diagram_stats AS
SELECT 
    d.id,
    d.name,
    d.package,
    d.created_at,
    d.updated_at,
    u.username as owner_username,
    COUNT(DISTINCT dc.user_id) as collaborator_count,
    COUNT(DISTINCT s.id) as active_sessions,
    COUNT(DISTINCT gp.id) as generated_projects_count
FROM diagrams d
LEFT JOIN users u ON d.owner_id = u.id
LEFT JOIN diagram_collaborators dc ON d.id = dc.diagram_id
LEFT JOIN sessions s ON d.id = s.diagram_id AND s.is_active = true
LEFT JOIN generated_projects gp ON d.id = gp.diagram_id
GROUP BY d.id, d.name, d.package, d.created_at, d.updated_at, u.username;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA uml_tool TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA uml_tool TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA uml_tool TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA uml_tool TO postgres;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'UML Tool database initialized successfully!';
    RAISE NOTICE 'Schema: uml_tool';
    RAISE NOTICE 'Sample data inserted';
    RAISE NOTICE 'Indexes and triggers created';
END $$;

