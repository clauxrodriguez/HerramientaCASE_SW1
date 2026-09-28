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

let discoveredModel: string | null = null;

async function getSupportedModel(apiKey: string, apiVersion: string): Promise<string | null> {
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  if (configuredModel) return configuredModel.replace(/^models\//, '');
  if (discoveredModel) return discoveredModel;

  const response = await axios.get(
    `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`,
    { timeout: 10_000 }
  );
  const models = (response.data?.models || [])
    .filter((model: any) => (model.supportedGenerationMethods || []).includes('generateContent'))
    .map((model: any) => String(model.name || '').replace(/^models\//, ''))
    .filter(Boolean);
  const preferred = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
  discoveredModel = preferred.find((candidate) => models.includes(candidate)) || models[0] || null;
  return discoveredModel;
}

/**
 * Llamada a la API de Gemini usando los modelos oficiales de Google AI Studio.
 */
export async function callGemini(opts: { prompt: string; imagePath?: string; timeoutMs?: number }): Promise<GeminiResponse> {
  const apiKey = [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY, process.env.OPENAI_API_KEY]
    .find((value) => Boolean(value?.trim()));
  const timeout = opts.timeoutMs ?? 15_000; // 15 segundos timeout por modelo

  if (!apiKey) {
    return { 
      normalized: null, 
      raw: { note: 'no API key configured', prompt: opts.prompt } 
    };
  }

  const apiVersion = process.env.GEMINI_API_VERSION || 'v1beta';
  let modelName: string;

  try {
    const supportedModel = await getSupportedModel(apiKey, apiVersion);
    if (!supportedModel) {
      return { normalized: null, raw: { error: 'No hay modelos Gemini con generateContent disponibles', status: 404 } };
    }
    modelName = supportedModel;
  } catch (err: any) {
    return {
      normalized: null,
      raw: {
        error: err?.response?.data?.error?.message || err?.message || 'No se pudo consultar los modelos Gemini',
        status: err?.response?.status || 500,
      },
    };
  }

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
    const msg = err?.response?.data?.error?.message || err?.message;
    const code = err?.response?.status;
    console.warn(`[Gemini] Modelo ${modelName} falló con status ${code}: ${msg}.`);
    return {
      normalized: null,
      raw: { error: msg || 'Gemini API not available', status: code || 500, model: modelName },
    };
  }
}