import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

import { setupRoutes } from './routes';
import { setupSocketHandlers } from './collaboration/socketHandlers';
import { initializeDatabase, closeDatabase } from './db/connection';

// ✅ Load environment variables desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, "../.env") });
console.log("OPENAI_API_KEY cargada:", !!process.env.OPENAI_API_KEY);

// ✅ Configuración flexible de CORS para Render / Local
const allowedOrigin = process.env.CORS_ORIGIN || process.env.CLIENT_URL || "*";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the frontend build
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Routes
setupRoutes(app);

// Socket.io handlers
setupSocketHandlers(io);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  // Serve the React app for all other routes
  return res.sendFile(path.join(frontendPath, 'index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
  } catch (error: any) {
    console.warn('⚠️ Base de Datos: No se pudo conectar a PostgreSQL (verificar contraseña en backend/.env o iniciar contenedor). El servidor iniciará en modo memoria.');
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔌 Socket.io server ready`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

startServer();