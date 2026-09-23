/**
 * Punto de entrada público del módulo de generación Flutter.
 *
 * Este archivo actúa como envoltorio ligero (facade) que expone la función principal
 * del generador y los tipos relacionados. Mantener aquí únicamente re-exports permite:
 * - Desacoplar la implementación interna (orchestrator, projectBuilder, etc.).
 * - Proveer una API estable hacia el resto del código (importar desde 'generator_flutter').
 * - Facilitar tests y mocking al importar desde un único punto.
 *
 * Uso:
 *  import { generateFlutterFromDiagram } from './src/generator_flutter/flutterGenerator';
 *  import type { UMLDiagramJSON, FlutterGeneratorOptions } from './src/generator_flutter/flutterGenerator';
 *
 * Nota:
 *  - La lógica real de generación se implementa en ./orchestrator.
 *  - Los tipos exportados provienen del archivo types.ts para garantizar contrato único.
 */

export { generateFlutterFromDiagram } from './orchestrator';
export type { UMLDiagramJSON, FlutterGeneratorOptions } from './types';