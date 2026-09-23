import { Router } from 'express';
import { generateSpringBootProject } from '../generator/springBootGenerator';
import { generateFlutterFromDiagram } from '../generator_flutter/flutterGenerator';
import path from 'path';

const router = Router();

/**
 * POST /api/generator/spring
 * Genera proyecto Spring Boot desde diagrama UML
 */
router.post('/spring', async (req, res) => {
  try {
    const umlData = req.body;
    
    if (!umlData || !umlData.package || !umlData.classes) {
      return res.status(400).json({ 
        error: 'Invalid UML data. Required: package, classes' 
      });
    }

    console.log('[Spring Generator] Generando proyecto para:', umlData.package);
    
    const zipBuffer = await generateSpringBootProject(umlData);
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${umlData.package.replace(/\./g, '-')}-project.zip"`);
    return res.send(zipBuffer);
    
  } catch (error) {
    console.error('[Spring Generator] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate Spring Boot project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/generator/flutter
 * Genera aplicación Flutter desde diagrama UML
 * Body: UMLDiagramJSON
 * Response: application/zip (attachment)
 */
router.post('/flutter', async (req, res) => {
  try {
    const diagram = req.body;
    
    // Validar entrada
    if (!diagram || !Array.isArray(diagram.classes)) {
      return res.status(400).json({ 
        error: 'Invalid diagram format. Required: { classes: [...] }' 
      });
    }

    if (diagram.classes.length === 0) {
      return res.status(400).json({ 
        error: 'Diagram must contain at least one class' 
      });
    }

    console.log('[Flutter Generator] Generando app para:', diagram.name || 'Sin nombre');
    console.log(`[Flutter Generator] Clases: ${diagram.classes.length}, Relaciones: ${diagram.relations?.length || 0}`);

    // Generar proyecto
    const zipPath = await generateFlutterFromDiagram(diagram, {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      enableWeb: true,
      enableWindows: true
    });

    // Verificar que el archivo existe
    const fs = require('fs').promises;
    try {
      await fs.access(zipPath);
    } catch {
      throw new Error(`ZIP file not found: ${zipPath}`);
    }

    console.log('[Flutter Generator] ✅ Enviando ZIP al cliente...');

    // Enviar archivo
    return res.download(zipPath, "flutter-app.zip", (err) => {
      if (err) {
        console.error('[Flutter Generator] Error al enviar ZIP:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error sending file' });
        }
      } else {
        console.log('[Flutter Generator] ✅ ZIP enviado exitosamente');
        
        // Limpiar archivo temporal después de enviarlo
        fs.unlink(zipPath).catch((unlinkErr: any) => {
          console.error('[Flutter Generator] Error al eliminar temporal:', unlinkErr);
        });
      }
    });

  } catch (err) {
    console.error('[Flutter Generator] ❌ Error:', err);
    return res.status(500).json({ 
      error: 'Error generando app Flutter',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

export { router as generatorRoutes };

