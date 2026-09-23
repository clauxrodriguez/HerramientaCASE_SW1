import express, { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { handleImageToDiagram } from './orchestrator';

export function createGeminiRouter(): Router {
  const router = Router();

  // Intentar usar multer si está disponible; si no, aceptar JSON { imagePath }
  let useMulter = false;
  let upload: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const multer = require('multer');
    const tmp = path.join(process.cwd(), 'tmp', 'uploads');
    fs.mkdirSync(tmp, { recursive: true });
    upload = multer({ dest: tmp });
    useMulter = true;
  } catch (err) {
    useMulter = false;
  }

  router.post('/image-to-diagram', useMulter ? upload.single('file') : (req: Request, _res: Response, next) => next(), async (req: Request, res: Response) => {
    try {
      let imagePath: string | undefined;
      if (useMulter && (req as any).file) {
        imagePath = (req as any).file.path;
      } else if (req.body && req.body.imagePath) {
        imagePath = req.body.imagePath;
      } else {
        return res.status(400).json({ error: 'No image provided. Use multipart form field "file" or JSON { imagePath }' });
      }

      const result = await handleImageToDiagram(imagePath!);
      return res.json(result);
    } catch (err: any) {
      console.error('gemini route error', err);
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  return router;
}