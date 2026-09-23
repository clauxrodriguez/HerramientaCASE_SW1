// Módulo simple que exporta el tipo Shape y una función parseVisionShapes.
// Implementación inicial: placeholder que devuelve [] (sin detección).
// Puedes reemplazar la lógica por OpenCV/heurísticas más adelante.

import fs from 'fs';
import axios from 'axios';
import { Shape as DiagramShape } from './diagramBuilder';

export type Shape = DiagramShape;

function bboxFromVertices(verts: any[] = []): { x: number; y: number; w: number; h: number } {
  const xs = verts.map((v: any) => (typeof v?.x === 'number' ? v.x : 0));
  const ys = verts.map((v: any) => (typeof v?.y === 'number' ? v.y : 0));
  const minX = xs.length ? Math.min(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxX = xs.length ? Math.max(...xs) : minX;
  const maxY = ys.length ? Math.max(...ys) : minY;
  return { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
}

function iou(a: { x:number;y:number;w:number;h:number }, b: { x:number;y:number;w:number;h:number }) {
  const ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx2 = b.x + b.w, by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

function mergeRects(rects: Array<{ x:number;y:number;w:number;h:number }>, threshold = 0.35) {
  const out: typeof rects = [];
  const used = new Array(rects.length).fill(false);
  for (let i=0;i<rects.length;i++) {
    if (used[i]) continue;
    let base = {...rects[i]};
    used[i] = true;
    for (let j=i+1;j<rects.length;j++) {
      if (used[j]) continue;
      if (iou(base, rects[j]) > threshold) {
        // merge by union
        const minX = Math.min(base.x, rects[j].x);
        const minY = Math.min(base.y, rects[j].y);
        const maxX = Math.max(base.x + base.w, rects[j].x + rects[j].w);
        const maxY = Math.max(base.y + base.h, rects[j].y + rects[j].h);
        base = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        used[j] = true;
      }
    }
    out.push(base);
  }
  return out;
}

/**
 * parseVisionShapes:
 * - intenta opencv4nodejs si está disponible (detección contornos y líneas).
 * - fallback: usa Google Vision DOCUMENT_TEXT_DETECTION y construye rects desde blocks/paragraphs.
 */
export async function parseVisionShapes(imagePath: string): Promise<Shape[]> {
  const shapes: Shape[] = [];
  if (!fs.existsSync(imagePath)) return shapes;

  // try opencv (dynamic)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cv = require('opencv4nodejs');
    const img = cv.imread(imagePath);
    const gray = img.bgrToGray();
    const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);
    const edged = blurred.canny(50, 150);
    const contours = edged.findContours(cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const rects: Array<{x:number;y:number;w:number;h:number}> = [];
    contours.forEach((cnt: any) => {
      const peri = cnt.arcLength(true);
      const approx = cnt.approxPolyDP(0.02 * peri, true);
      if (approx.length === 4 && Math.abs(cnt.area) > 2000) {
        const r = cnt.boundingRect();
        rects.push({ x: r.x, y: r.y, w: r.width, h: r.height });
      }
    });

    const merged = mergeRects(rects, 0.35);
    merged.forEach(r => shapes.push({ type: 'rect', bbox: r }));

    // lines
    const lines = edged.houghLinesP(1, Math.PI / 180, 80, 30, 10) || [];
    lines.forEach((ln: any) => {
      shapes.push({ type: 'line', points: [{ x: ln.x1, y: ln.y1 }, { x: ln.x2, y: ln.y2 }] });
    });

    return shapes;
  } catch (err) {
    // opencv no disponible -> continue to fallback
  }

  // fallback: Google Vision
  const gKey = process.env.GOOGLE_API_KEY;
  if (!gKey) return shapes;

  try {
    const buf = await fs.promises.readFile(imagePath);
    const content = buf.toString('base64');
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${gKey}`;
    const payload = {
      requests: [
        {
          image: { content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 20 }],
        },
      ],
    };
    const res = await axios.post(url, payload, { timeout: 30000 });
    const annot = res.data?.responses?.[0];
    if (!annot) return shapes;

    const rects: Array<{x:number;y:number;w:number;h:number}> = [];

    if (annot.fullTextAnnotation && annot.fullTextAnnotation.pages) {
      for (const page of annot.fullTextAnnotation.pages || []) {
        for (const block of page.blocks || []) {
          const bbox = bboxFromVertices(block.boundingBox?.vertices || []);
          if (bbox.w > 30 && bbox.h > 12) rects.push(bbox);
          else {
            for (const para of block.paragraphs || []) {
              const pb = bboxFromVertices(para.boundingBox?.vertices || []);
              if (pb.w > 30 && pb.h > 12) rects.push(pb);
            }
          }
        }
      }
    } else if (annot.textAnnotations && annot.textAnnotations.length) {
      for (const ta of annot.textAnnotations) {
        const bbox = bboxFromVertices(ta.boundingPoly?.vertices || []);
        if (bbox.w > 40 && bbox.h > 10) rects.push(bbox);
      }
    }

    const merged = mergeRects(rects, 0.3);
    merged.forEach(r => shapes.push({ type: 'rect', bbox: r }));

    // simple lines heuristic: connect rect centers if roughly aligned and reasonably close
    for (let i=0;i<merged.length;i++) {
      for (let j=i+1;j<merged.length;j++) {
        const a = merged[i], b = merged[j];
        const ax = a.x + a.w/2, ay = a.y + a.h/2;
        const bx = b.x + b.w/2, by = b.y + b.h/2;
        const dx = bx - ax, dy = by - ay;
        const dist = Math.hypot(dx, dy);
        const angle = Math.abs(Math.atan2(dy, dx)); // radians
        // prefer horizontal/vertical-ish connections and moderate distance
        const angleOk = (Math.abs(angle) < 0.35) || (Math.abs(angle - Math.PI/2) < 0.35);
        if (angleOk && dist < Math.max(a.w, b.w) * 6 && dist > 10) {
          shapes.push({ type: 'line', points: [{ x: ax, y: ay }, { x: bx, y: by }] });
        }
      }
    }

    return shapes;
  } catch (err: any) {
    // Error 403: API no habilitada o sin permisos - esto es normal si no tienes Google Vision API habilitada
    const statusCode = err?.response?.status;
    if (statusCode === 403) {
      console.log('Google Vision API no disponible (403) para detección de formas. Continuando sin detección de formas...');
    } else {
      console.warn('visionParser fallback failed:', err?.message || String(err));
    }
    return shapes;
  }
}