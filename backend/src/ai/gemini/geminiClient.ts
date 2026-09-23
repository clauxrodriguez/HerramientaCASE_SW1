import dotenv from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';

dotenv.config();

export interface GeminiResponse {
  normalized?: any;
  raw?: any;
}

/**
 * Llamada a la API de Gemini usando los modelos oficiales de Google AI Studio.
 */
export async function callGemini(opts: { prompt: string; imagePath?: string; timeoutMs?: number }): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? process.env.OPENAI_API_KEY;
  const timeout = opts.timeoutMs ?? 15_000; // 15 segundos timeout por modelo

  if (!apiKey) {
    return { 
      normalized: null, 
      raw: { note: 'no API key configured', prompt: opts.prompt } 
    };
  }

  // Modelos oficiales soportados por la API de Google
  const candidateModels = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash-exp',
    'gemini-pro-vision'
  ];
  const apiVersion = process.env.GEMINI_API_VERSION || 'v1beta';
  let lastErrRes: any = null;

  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
      const parts: any[] = [{ text: opts.prompt }];

      if (opts.imagePath && fs.existsSync(opts.imagePath)) {
        const buf = fs.readFileSync(opts.imagePath);
        const base64Image = buf.toString('base64');
        const mimeType = mime.lookup(opts.imagePath) || 'image/jpeg';
        parts.push({
          inline_data: { mime_type: mimeType, data: base64Image }
        });
      }

      const payload = {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      };

      console.log(`[Gemini] Probando modelo: ${modelName}...`);
      const res = await axios.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout,
      });

      const raw = res.data;
      const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        try {
          let jsonText = text.trim();
          const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) jsonText = jsonMatch[1].trim();
          const parsed = JSON.parse(jsonText);
          return { normalized: parsed, raw };
        } catch (parseErr) {
          return { normalized: null, raw: { text, parseError: String(parseErr), fullResponse: raw } };
        }
      }
    } catch (err: any) {
      lastErrRes = err;
      const msg = err?.response?.data?.error?.message || err?.message;
      const code = err?.response?.status;
      console.warn(`[Gemini] Modelo ${modelName} falló con status ${code}: ${msg}.`);
    }
  }

  return {
    normalized: null,
    raw: {
      error: lastErrRes?.response?.data?.error?.message || lastErrRes?.message || 'Gemini API not available',
      status: lastErrRes?.response?.status || 500
    }
  };
}