// Tipos para la respuesta del API
export interface ParseDiagramResult {
  diagram: {
    classes: Array<{
      id: string;
      name: string;
      attributes: string[];
    }>;
    relations: Array<{
      from?: string;
      to?: string;
      type?: string;
    }>;
  };
  meta: {
    engine: 'gemini' | 'fallback';
    model?: string;
    elapsed?: string;
    imageSize?: string;
    language?: string;
    useLLM?: boolean;
    error?: string;
    statusCode?: number;
  };
}

import { API_BASE } from '../config';

/**
 * Sube una imagen y la convierte en diagrama UML
 * @param file - Archivo de imagen a procesar
 * @param options - Opciones de procesamiento
 * @param onProgress - Callback opcional para reportar progreso de upload
 * @returns Promise con el resultado del análisis
 */
export async function uploadImageFile(
  file: File,
  // backward-compatible: allow passing onProgress as the 2nd argument
  options: { lang?: string; useLLM?: boolean } | ((pct: number) => void) = {},
  onProgress?: (pct: number) => void
): Promise<ParseDiagramResult> {
  // normalize args: if options is a function, treat it as onProgress
  if (typeof options === 'function') {
    onProgress = options as (pct: number) => void;
    options = {};
  }

  return new Promise((resolve, reject) => {
  const url = `${API_BASE}/api/ai/image-to-diagram`;
    const form = new FormData();
    form.append('file', file);
    
  // Agregar opciones si están presentes
  const opts = options as { lang?: string; useLLM?: boolean };
  if (opts.lang) form.append('lang', opts.lang);
  if (opts.useLLM === false) form.append('useLLM', 'false');

    // Usamos XMLHttpRequest para poder reportar progreso de upload
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json);
        } else {
          // Manejar errores específicos
          const error = new Error(json.error || 'Failed to parse image');
          (error as any).status = xhr.status;
          (error as any).details = json.details || json;
          reject(error);
        }
      } catch (err) {
        const error = new Error('Failed to parse response');
        (error as any).status = xhr.status;
        (error as any).body = xhr.responseText;
        reject(error);
      }
    };
    
    xhr.onerror = () => {
      const error = new Error('Network error');
      (error as any).status = xhr.status;
      reject(error);
    };
    
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          onProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
    }
    
    xhr.send(form);
  });
}

/**
 * Envía una ruta de imagen al servidor para procesarla
 * @param imagePath - Ruta del archivo de imagen en el servidor
 * @param options - Opciones de procesamiento
 * @returns Promise con el resultado del análisis
 */
export async function sendImagePath(
  imagePath: string,
  options: { lang?: string; useLLM?: boolean } = {}
): Promise<ParseDiagramResult> {
  const url = `${API_BASE}/api/ai/image-to-diagram`;
  const body: any = { imagePath };
  
  // Agregar opciones al body
  if (options.lang) body.lang = options.lang;
  if (options.useLLM === false) body.useLLM = false;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const json = await res.json();
  
  if (!res.ok) {
    const error = new Error(json.error || 'Failed to parse image');
    (error as any).status = res.status;
    (error as any).details = json.details || json;
    throw error;
  }
  
  return json;
}

/**
 * Alias para mantener compatibilidad con código existente
 * @deprecated Usar uploadImageFile con opciones
 */
export async function parseDiagramImage(
  file: File,
  options: { lang?: string; useLLM?: boolean } = {}
): Promise<ParseDiagramResult> {
  return uploadImageFile(file, options);
}