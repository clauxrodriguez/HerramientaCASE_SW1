import { Router } from 'express';
import { getAISuggestions, generateFromText, generateDiagramFromText, modifyDiagramFromText } from '../ai/openaiService';
import { applyActionsToDiagram } from '../ai/applyUMLActions'; // crear/importar implementacion

const router = Router();

router.post('/suggest', async (req, res): Promise<void> => {
  try {
    const umlData = req.body;
    
    if (!umlData || !umlData.classes) {
      res.status(400).json({ 
        error: 'Invalid UML data. Required: classes array' 
      });
      return;
    }

    console.log('Getting AI suggestions for UML diagram');
    
    const suggestions = await getAISuggestions(umlData);
    
    res.json({ suggestions });

  } catch (error) {
    console.error('Error getting AI suggestions:', error);
    res.status(500).json({ 
      error: 'Failed to get AI suggestions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/from-text', async (req, res): Promise<void> => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      res.status(400).json({ 
        error: 'Invalid input. Required: text string' 
      });
      return;
    }

    console.log('Generating UML class from text:', text);
    
    const umlClass = await generateFromText(text);
    
    res.json(umlClass);

  } catch (error) {
    console.error('Error generating from text:', error);
    res.status(500).json({ 
      error: 'Failed to generate UML from text',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/generate-diagram', async (req, res): Promise<void> => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      res.status(400).json({ 
        error: 'Invalid input. Required: text string' 
      });
      return;
    }

    console.log('Generating UML diagram from text:', text);
    
    const diagramResponse = await generateDiagramFromText(text);
    
    res.json(diagramResponse);

  } catch (error) {
    console.error('Error generating diagram from text:', error);
    res.status(500).json({ 
      error: 'Failed to generate UML diagram from text',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as aiRoutes };

// Nueva ruta: modificar diagrama a partir de texto + estado actual (aplica, persiste y emite)
router.post('/modify-diagram', async (req, res): Promise<void> => {
  try {
    const { text, diagram } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Invalid input. Required: text string' });
      return;
    }
    if (!diagram || typeof diagram !== 'object') {
      res.status(400).json({ error: 'Invalid input. Required: diagram object' });
      return;
    }

    // 1) Si el cliente envía 'actions' explícitas, úsalas. Si no, pide acciones a la IA.
    let actions: any[] = [];
    if (Array.isArray(req.body.actions) && req.body.actions.length > 0) {
      actions = req.body.actions;
    } else {
      const actionResponse = await modifyDiagramFromText(diagram, text);
      actions = actionResponse.actions || [];
    }

    // 2) Validar acciones (recomendado: zod/AJV) - omito validación completa aquí

    // 3) Aplicar acciones al diagrama (no muta el original)
    const updatedDiagram = applyActionsToDiagram(diagram, actions);

    // 4) Persistir el diagrama actualizado (TODO: conectar con tu repo/db)
    // Example: await persistDiagram(updatedDiagram, diagramId);
    // Implementa persistDiagram en tu capa db/repository
    // await persistDiagram(updatedDiagram);

    // 5) Emitir evento de colaboración -> notificar a clientes conectados (TODO)
    // Example: broadcastUpdate(updatedDiagram);
    // Implementa broadcastUpdate usando tu socket manager (Socket.IO / ws)

    // 6) Devolver acciones y diagrama actualizado al cliente
    // además incluir warnings si el aplicador las generó
    const warnings = (updatedDiagram && (updatedDiagram as any)._aiWarnings) || [];
    res.json({ actions, updatedDiagram, warnings });
  } catch (error) {
    console.error('Error modifying diagram from text:', error);
    res.status(500).json({
      error: 'Failed to modify UML diagram from text',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
