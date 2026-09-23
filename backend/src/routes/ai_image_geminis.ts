import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { handleImageToDiagram, handleImageBufferToDiagram, DiagramModel } from '../ai/gemini/orchestrator';

/**
 * Transforma el DiagramModel de Gemini al formato esperado por el frontend
 * - Convierte from/to a source/target usando nombres de clases
 * - Normaliza tipos de relación
 * - Asegura que las cardinalidades estén presentes
 */
function transformGeminiDiagramToFrontendFormat(geminiDiagram: DiagramModel): any {
  // Crear mapa de IDs a nombres de clases
  const idToNameMap = new Map<string, string>();
  geminiDiagram.classes.forEach(cls => {
    idToNameMap.set(cls.id, cls.name);
  });

  // Transformar clases
  const transformedClasses = geminiDiagram.classes.map(cls => ({
    name: cls.name,
    attributes: cls.attributes || [],
    methods: [] // Gemini no extrae métodos por ahora
  }));

  // Transformar relaciones
  const transformedRelations = geminiDiagram.relations.map((rel, index) => {
    // Resolver source y target (pueden ser IDs o nombres)
    const sourceId = rel.from || rel.source;
    const targetId = rel.to || rel.target;
    
    const sourceName = idToNameMap.get(sourceId || '') || sourceId || '';
    const targetName = idToNameMap.get(targetId || '') || targetId || '';

    // Normalizar tipo de relación
    const validTypes = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY', 'INHERITANCE', 'COMPOSITION', 'AGGREGATION'];
    let relationType = (rel.type || 'ONE_TO_MANY').toUpperCase();
    
    if (relationType.includes('INHERITANCE') || relationType.includes('EXTENDS') || relationType === 'INHERIT') {
      relationType = 'INHERITANCE';
    } else if (relationType.includes('COMPOSITION') || relationType.includes('COMPOSE')) {
      relationType = 'COMPOSITION';
    } else if (relationType.includes('AGGREGATION') || relationType.includes('AGGREGATE')) {
      relationType = 'AGGREGATION';
    } else if (relationType === 'ONE_TO_ONE' || relationType === '1_TO_1' || relationType === '1:1') {
      relationType = 'ONE_TO_ONE';
    } else if (relationType === 'ONE_TO_MANY' || relationType === '1_TO_MANY' || relationType === '1:N' || relationType === '1:*') {
      relationType = 'ONE_TO_MANY';
    } else if (relationType === 'MANY_TO_ONE' || relationType === 'MANY_TO_1' || relationType === 'N:1' || relationType === '*:1') {
      relationType = 'MANY_TO_ONE';
    } else if (relationType === 'MANY_TO_MANY' || relationType === 'N:M' || relationType === '*:*' || relationType === 'M:N') {
      relationType = 'MANY_TO_MANY';
    } else {
      relationType = 'ONE_TO_MANY'; // Por defecto
    }

    // Validar que el tipo sea válido
    if (!validTypes.includes(relationType)) {
      relationType = 'ONE_TO_MANY';
    }

    // Función para normalizar cardinalidades
    const normalizeCard = (card: string | undefined): string => {
      if (!card) return '*';
      const normalized = card.trim();
      if (normalized === 'n' || normalized === 'N' || normalized === '*' || normalized === 'many') return '*';
      if (normalized === '1' || normalized === 'one' || normalized === 'uno') return '1';
      if (normalized === '0..1' || normalized === '0-1' || normalized === '0 to 1') return '0..1';
      if (normalized === '1..*' || normalized === '1-*' || normalized === '1 to many' || normalized === '1..n') return '1..*';
      if (normalized === '0..*' || normalized === '0-*' || normalized === '0 to many' || normalized === '0..n') return '0..*';
      return normalized;
    };

    // Normalizar cardinalidades
    let sourceCardinality = normalizeCard(rel.sourceCardinality);
    let targetCardinality = normalizeCard(rel.targetCardinality);

    // Si no se proporcionaron cardinalidades o ambas son * (por defecto), inferir según tipo
    const hasProvidedCardinalities = rel.sourceCardinality || rel.targetCardinality;
    if (!hasProvidedCardinalities || (sourceCardinality === '*' && targetCardinality === '*')) {
      switch (relationType) {
        case 'ONE_TO_ONE':
          sourceCardinality = '1';
          targetCardinality = '1';
          break;
        case 'ONE_TO_MANY':
          sourceCardinality = '1';
          targetCardinality = '*';
          break;
        case 'MANY_TO_ONE':
          sourceCardinality = '*';
          targetCardinality = '1';
          break;
        case 'MANY_TO_MANY':
          sourceCardinality = '*';
          targetCardinality = '*';
          break;
        case 'INHERITANCE':
        case 'COMPOSITION':
        case 'AGGREGATION':
          sourceCardinality = '1';
          targetCardinality = '*';
          break;
        default:
          // Mantener las cardinalidades normalizadas si no hay tipo específico
          break;
      }
    }

    return {
      source: sourceName,
      target: targetName,
      type: relationType,
      sourceCardinality,
      targetCardinality
    };
  });

  return {
    classes: transformedClasses,
    relations: transformedRelations
  };
}

const router = Router();

// Configurar multer con memoryStorage (como el código del amigo)
let useMulter = false;
let upload: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const multer = require('multer');
  const storage = multer.memoryStorage();
  upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB límite
  });
  useMulter = true;
} catch (err) {
  useMulter = false;
}

/**
 * POST /api/ai/image-to-diagram
 * - multipart form: field "file" (imagen en buffer)
 * - or JSON body: { "imagePath": "/absolute/or/server/path/to/image.jpg" }
 */
router.post(
  '/image-to-diagram',
  useMulter ? upload.single('file') : (req: Request, _res: Response, next) => next(),
  async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      
      // Opciones opcionales (como el código del amigo)
      const language = (req.body?.lang as string) || 'es';
      const useLLM = req.body?.useLLM !== 'false'; // default true

      // Si hay archivo en buffer (multer memoryStorage)
      if (useMulter && (req as any).file && (req as any).file.buffer) {
        const file = (req as any).file;
        const imageBuffer = file.buffer;
        const imageSize = (imageBuffer.length / 1024).toFixed(2);

        console.log(`[image-to-diagram] Received image: ${file.originalname || 'unknown'}`);
        console.log(`[image-to-diagram] Image size: ${imageSize} KB`);
        console.log(`[image-to-diagram] MIME type: ${file.mimetype}`);
        console.log(`[image-to-diagram] Options: language=${language}, useLLM=${useLLM}`);

        // Usar buffer directamente
        const result = await handleImageBufferToDiagram(imageBuffer, {
          language,
          useLLM,
          mimeType: file.mimetype,
          originalName: file.originalname
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[image-to-diagram] Analysis completed in ${elapsed}s`);
        console.log(`[image-to-diagram] Result: ${result.diagram?.classes?.length || 0} classes, ${result.diagram?.relations?.length || 0} relations`);

        // Construir metadata con información de error si hay fallback
        const meta = {
          engine: result.geminiNormalized ? 'gemini' : 'fallback',
          model: result.geminiRaw?.model || 'heuristic',
          elapsed: `${elapsed}s`,
          imageSize: `${imageSize} KB`,
          language,
          useLLM,
          ...(result.geminiRaw?.error && { error: result.geminiRaw.error }),
          ...(result.geminiRaw?.status && { statusCode: result.geminiRaw.status })
        };

        // Transformar diagrama al formato esperado por el frontend
        const transformedDiagram = transformGeminiDiagramToFrontendFormat(result.diagram);

        // Retornar diagrama transformado con HTTP 200 para que el frontend lo pueda renderizar siempre
        return res.json({
          diagram: transformedDiagram,
          meta
        });
      }

      // Fallback: usar imagePath (ruta de archivo)
      if (req.body && typeof req.body.imagePath === 'string') {
        const imagePath = req.body.imagePath;
        console.log(`[image-to-diagram] Using image path: ${imagePath}`);
        console.log(`[image-to-diagram] Options: language=${language}, useLLM=${useLLM}`);
        
        const result = await handleImageToDiagram(imagePath, { useLLM });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`[image-to-diagram] Analysis completed in ${elapsed}s`);
        console.log(`[image-to-diagram] Result: ${result.diagram?.classes?.length || 0} classes, ${result.diagram?.relations?.length || 0} relations`);

        // Construir metadata con información de error si hay fallback
        const meta = {
          engine: result.geminiNormalized ? 'gemini' : 'fallback',
          model: result.geminiRaw?.model || 'heuristic',
          elapsed: `${elapsed}s`,
          language,
          useLLM,
          ...(result.geminiRaw?.error && { error: result.geminiRaw.error }),
          ...(result.geminiRaw?.status && { statusCode: result.geminiRaw.status })
        };

        // Transformar diagrama al formato esperado por el frontend
        const transformedDiagram = transformGeminiDiagramToFrontendFormat(result.diagram);

        return res.json({
          diagram: transformedDiagram,
          meta
        });
      }

      return res.status(400).json({ error: 'No image provided. Use multipart form "file" or JSON { imagePath }' });
    } catch (err: any) {
      console.error('[image-to-diagram] Error processing image:', err);
      
      // Determinar código de estado apropiado
      let statusCode = 500;
      if (err?.response?.status) {
        statusCode = err.response.status;
      } else if (err?.message?.includes('API key')) {
        statusCode = 401;
      } else if (err?.message?.includes('timeout')) {
        statusCode = 504;
      }
      
      return res.status(statusCode).json({ 
        error: 'Error processing image', 
        details: err?.message || String(err),
        ...(err?.response?.data && { apiError: err.response.data })
      });
    }
  }
);

export default router;