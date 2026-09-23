import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { OCRText } from './diagramBuilder';

// re-exportar el tipo para que otros módulos puedan importarlo desde './ocr'
export type { OCRText } from './diagramBuilder';

async function imageToBase64(filePath: string): Promise<string> {
  const buf = await fs.promises.readFile(filePath);
  return buf.toString('base64');
}

/**
 * runOCR:
 * - Si existe GOOGLE_API_KEY en env, usa Google Vision DOCUMENT_TEXT_DETECTION y agrupa palabras en líneas.
 * - En caso contrario intenta usar tesseract.js dinámicamente si está instalado.
 * - Devuelve array de OCRText { text, bbox } con bbox {x,y,w,h}.
 */
export async function runOCR(imagePath: string): Promise<OCRText[]> {
  // Preferir Google Vision REST API cuando hay clave en .env
  const gKey = process.env.GOOGLE_API_KEY;
  if (gKey) {
    try {
      const content = await imageToBase64(imagePath);
      const url = `https://vision.googleapis.com/v1/images:annotate?key=${gKey}`;
      const payload = {
        requests: [
          {
            image: { content },
            // DOCUMENT_TEXT_DETECTION proporciona fullTextAnnotation + words/symbols
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 50 }],
            imageContext: {},
          },
        ],
      };
      const res = await axios.post(url, payload, { timeout: 30000 });
      const resp = res.data;
      const annot = resp?.responses?.[0];
      if (!annot) return [];

      // If fullTextAnnotation pages exist, extract words (with bbox) and cluster into lines
      if (annot.fullTextAnnotation && Array.isArray(annot.fullTextAnnotation.pages) && annot.fullTextAnnotation.pages.length) {
        type WordItem = { text: string; bbox: { x: number; y: number; w: number; h: number }; centerY: number; centerX: number };
        const words: WordItem[] = [];

        for (const page of annot.fullTextAnnotation.pages || []) {
          for (const block of page.blocks || []) {
            for (const para of block.paragraphs || []) {
              for (const word of para.words || []) {
                const wordText = (word.symbols || []).map((s: any) => s.text).join('');
                if (!wordText) continue;
                // compute union bbox for the word from symbols
                const verts: Array<{ x?: number; y?: number }> = (word.boundingBox?.vertices || []).map((v: any) => ({ x: v.x ?? 0, y: v.y ?? 0 }));
                const xs = verts.map((v: { x?: number }) => v.x ?? 0);
                const ys = verts.map((v: { y?: number }) => v.y ?? 0);
                const minX = xs.length ? Math.min(...xs) : 0;
                const minY = ys.length ? Math.min(...ys) : 0;
                const maxX = xs.length ? Math.max(...xs) : minX;
                const maxY = ys.length ? Math.max(...ys) : minY;
                const w = Math.max(0, maxX - minX);
                const h = Math.max(0, maxY - minY);
                const centerX = minX + w / 2;
                const centerY = minY + h / 2;
                words.push({ text: wordText, bbox: { x: Math.round(minX), y: Math.round(minY), w: Math.round(w), h: Math.round(h) }, centerY, centerX });
              }
            }
          }
        }

        if (!words.length) {
          // fallback to textAnnotations if no words
        } else {
          // cluster words into lines by centerY
          const lines: Array<WordItem[]> = [];
          // adaptive threshold: median word height or a minimum
          const heights = words.map((w) => w.bbox.h).filter((h) => h > 0);
          const medianH = heights.length ? heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] : 12;
          const yThreshold = Math.max(6, Math.round(medianH * 0.8));

          for (const w of words) {
            let placed = false;
            for (const ln of lines) {
              if (Math.abs(w.centerY - ln[0].centerY) <= yThreshold) {
                ln.push(w);
                placed = true;
                break;
              }
            }
            if (!placed) lines.push([w]);
          }

          // build OCRText per line: sort by centerX and union bbox
          const ocrLines: OCRText[] = lines.map((ln) => {
            const sorted = ln.sort((a, b) => a.centerX - b.centerX);
            const text = sorted.map((s) => s.text).join(' ');
            const minX = Math.min(...sorted.map((s) => s.bbox.x));
            const minY = Math.min(...sorted.map((s) => s.bbox.y));
            const maxX = Math.max(...sorted.map((s) => s.bbox.x + s.bbox.w));
            const maxY = Math.max(...sorted.map((s) => s.bbox.y + s.bbox.h));
            return { text: text.trim(), bbox: { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) } };
          });

          return ocrLines;
        }
      }

      // Fallback: use textAnnotations array (words/tokens). textAnnotations[0] is full text.
      if (annot.textAnnotations && Array.isArray(annot.textAnnotations) && annot.textAnnotations.length > 1) {
        type Token = { text: string; bbox: { x: number; y: number; w: number; h: number }; centerX: number; centerY: number };
        const tokens: Token[] = annot.textAnnotations.slice(1).map((a: any) => {
          const verts: Array<{ x?: number; y?: number }> = a.boundingPoly?.vertices || [];
          const xs = verts.map((v: { x?: number }) => v.x ?? 0);
          const ys = verts.map((v: { y?: number }) => v.y ?? 0);
          const minX = xs.length ? Math.min(...xs) : 0;
          const minY = ys.length ? Math.min(...ys) : 0;
          const maxX = xs.length ? Math.max(...xs) : minX;
          const maxY = ys.length ? Math.max(...ys) : minY;
          return { text: a.description, bbox: { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) }, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
        });

        // cluster tokens into lines similarly
        const lines: Array<Token[]> = [];
        const heights = tokens.map((t) => t.bbox.h).filter((h) => h > 0);
        const medianH = heights.length ? heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] : 12;
        const yThreshold = Math.max(6, Math.round(medianH * 0.8));

        for (const tk of tokens) {
          let placed = false;
          for (const ln of lines) {
            if (Math.abs(tk.centerY - ln[0].centerY) <= yThreshold) {
              ln.push(tk);
              placed = true;
              break;
            }
          }
          if (!placed) lines.push([tk]);
        }

        const ocrLines: OCRText[] = lines.map((ln) => {
          const sorted = ln.sort((a, b) => a.centerX - b.centerX);
          const text = sorted.map((s) => s.text).join(' ');
          const minX = Math.min(...sorted.map((s) => s.bbox.x));
          const minY = Math.min(...sorted.map((s) => s.bbox.y));
          const maxX = Math.max(...sorted.map((s) => s.bbox.x + s.bbox.w));
          const maxY = Math.max(...sorted.map((s) => s.bbox.y + s.bbox.h));
          return { text: text.trim(), bbox: { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) } };
        });

        return ocrLines;
      }

      // final fallback: full text block (no bbox info)
      const fullText = annot.fullTextAnnotation?.text ?? annot.textAnnotations?.[0]?.description ?? '';
      if (fullText) {
        const lines = String(fullText).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        return lines.map((l) => ({ text: l }));
      }

      return [];
    } catch (err: any) {
      // Error 403: API no habilitada o sin permisos - esto es normal si no tienes Google Vision API habilitada
      // Error 400: API key inválida o mal formada
      const statusCode = err?.response?.status;
      if (statusCode === 403) {
        console.log('Google Vision API no disponible (403). Usando fallback OCR...');
      } else if (statusCode === 400) {
        console.warn('Google Vision API key inválida. Usando fallback OCR...');
      } else {
        console.warn('Google Vision OCR falló, usando fallback:', err?.message || String(err));
      }
      // continue to tesseract fallback
    }
  }

  // Fallback: try tesseract.js dynamically (if installed)
  try {
    // dynamic import to avoid hard dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Tesseract = require('tesseract.js');
    if (Tesseract && typeof Tesseract.recognize === 'function') {
      const res = await Tesseract.recognize(imagePath, 'eng', { logger: () => {} });
      const data = res?.data;
      const results: OCRText[] = [];
      if (data && data.blocks) {
        for (const block of data.blocks) {
          const lines = (block.lines || []);
          for (const line of lines) {
            const text = line.text?.trim();
            if (!text) continue;
            // compute bbox
            const bbox = {
              x: line.bbox?.x ?? line.bbox?.x0 ?? 0,
              y: line.bbox?.y ?? line.bbox?.y0 ?? 0,
              w: line.bbox?.w ?? (line.bbox?.x1 ? line.bbox.x1 - line.bbox.x0 : 0),
              h: line.bbox?.h ?? (line.bbox?.y1 ? line.bbox.y1 - line.bbox.y0 : 0),
            };
            results.push({ text, bbox });
          }
        }
      } else if (data && data.text) {
        // fallback to raw text (no bbox)
        const blocks = String(data.text).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
        for (const b of blocks) results.push({ text: b });
      }
      return results;
    }
  } catch (err) {
    // ignore: tesseract not installed
  }

  // Último recurso: devolver texto vacío
  return [];
}