// ...new file...
/**
 * Cliente ligero para consumir la ruta /api/ai/modify-diagram
 * - Llama al endpoint con { text, diagram }
 * - Valida respuesta y lanza errores en caso necesario
 */

import { apiPath } from '../config';

export type UMLActionType =
  | 'CREATE_CLASS' | 'UPDATE_CLASS' | 'DELETE_CLASS' | 'RENAME_CLASS'
  | 'ADD_ATTRIBUTE' | 'UPDATE_ATTRIBUTE' | 'DELETE_ATTRIBUTE'
  | 'ADD_METHOD' | 'UPDATE_METHOD' | 'DELETE_METHOD'
  | 'CREATE_RELATION' | 'UPDATE_RELATION' | 'DELETE_RELATION';

export interface UMLActionTarget {
  className?: string;
  newClassName?: string;
  relationId?: string;
  sourceClassName?: string;
  targetClassName?: string;
  attributeName?: string;
  newAttributeName?: string;
  methodName?: string;
  newMethodName?: string;
}

export interface UMLAction {
  type: UMLActionType;
  target?: UMLActionTarget;
  payload?: any;
  reason?: string;
}

export interface UMLActionResponse {
  actions: UMLAction[];
}

export interface ModifyDiagramResult {
  actions: UMLAction[];
  updatedDiagram?: any;
  warnings?: string[];
}

/**
 * modifyDiagram
 * -------------
 * Llama al endpoint del servidor que usa OpenAI para generar acciones sobre un diagrama
 *
 * Params:
 * - text: instrucción en lenguaje natural
 * - diagram: objeto del diagrama actual (serializable)
 * - opts.baseUrl (opcional): base URL para la API, por defecto '/api/ai/modify-diagram'
 *
 * Returns:
 * - Promise<ModifyDiagramResult>
 *
 * Lanzará excepción en caso de error de red o respuesta no OK.
 */
export async function modifyDiagram(text: string, diagram: any, opts?: { baseUrl?: string, signal?: AbortSignal }): Promise<ModifyDiagramResult> {
  if (!text || typeof text !== 'string') throw new Error('Invalid "text" parameter');
  if (!diagram || typeof diagram !== 'object') throw new Error('Invalid "diagram" parameter');

  // default to centralized API_BASE if no baseUrl provided
  // keep supporting an optional custom baseUrl for flexibility
  const url = (opts?.baseUrl ?? apiPath('/api/ai/modify-diagram'));

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, diagram }),
    signal: opts?.signal
  });

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => '');
    throw new Error(`API error ${resp.status}: ${bodyText}`);
  }

  const data = await resp.json().catch(() => null);
  if (!data || !Array.isArray(data.actions)) {
    throw new Error('Invalid response shape from modify-diagram API');
  }

  return {
    actions: data.actions as UMLAction[],
    updatedDiagram: data.updatedDiagram,
    warnings: data.warnings || []
  };
}

/**
 * Ejemplo de uso (frontend):
 *
 * import { modifyDiagram } from '../services/aiService';
 *
 * const result = await modifyDiagram("añade email a Usuario", currentDiagram);
 * // result.actions -> lista de acciones propuestas por AI
 * // result.updatedDiagram -> diagrama resultante si el servidor lo devolvió
 */