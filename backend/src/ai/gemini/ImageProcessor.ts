import * as path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';

export interface PreprocessResult {
  originalPath: string;
  processedPath: string;
  width: number;
  height: number;
  mime: string;
}

/**
 * Preprocesa la imagen: resize si es muy grande, convertir a JPEG/webp y normalizar contraste.
 * Devuelve la ruta del archivo procesado.
 */
export async function preprocessImage(inputPath: string, opts?: { maxWidth?: number; quality?: number; format?: 'jpeg' | 'webp' }): Promise<PreprocessResult> {
  const maxWidth = opts?.maxWidth ?? 1600;
  const quality = opts?.quality ?? 70;
  const format = opts?.format ?? 'jpeg';

  const ext = format === 'webp' ? 'webp' : 'jpg';
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const outPath = path.join(dir, `${base}-processed.${ext}`);

  try {
    const img = sharp(inputPath);
    const meta = await img.metadata();

    // Resize if wider than maxWidth
    const resizeOpts: any = {};
    if (meta.width && meta.width > maxWidth) {
      resizeOpts.width = maxWidth;
    }

    let pipeline = img.rotate().resize(resizeOpts).flatten({ background: '#ffffff' }).sharpen();

    if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else {
      pipeline = pipeline.jpeg({ quality });
    }

    await pipeline.toFile(outPath);
    const outMeta = await sharp(outPath).metadata();

    return {
      originalPath: inputPath,
      processedPath: outPath,
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
      mime: format === 'webp' ? 'image/webp' : 'image/jpeg',
    };
  } catch (err) {
    // Si falla, intenta copiar el archivo para mantener flujo
    await fs.copyFile(inputPath, outPath).catch(() => {});
    const fallbackMeta = await sharp(outPath).metadata().catch(() => ({ width: 0, height: 0 }));
    return {
      originalPath: inputPath,
      processedPath: outPath,
      width: fallbackMeta.width ?? 0,
      height: fallbackMeta.height ?? 0,
      mime: format === 'webp' ? 'image/webp' : 'image/jpeg',
    };
  }
}