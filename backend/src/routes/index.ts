import { Express } from 'express';
import { generatorRoutes } from './generator';
import { aiRoutes } from './ai';
import aiImageRoutes from './ai_image_geminis';

export function setupRoutes(app: Express) {
  // API routes with /api prefix
  app.use('/api/generator', generatorRoutes);
  // rutas generales de AI
  app.use('/api/ai', aiRoutes);
  // rutas específicas para image-to-diagram (queda como /api/ai/image-to-diagram)
  app.use('/api/ai', aiImageRoutes);
}

