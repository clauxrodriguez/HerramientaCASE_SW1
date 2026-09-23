import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { mkdir } from 'fs/promises';
import { UMLDiagramJSON, FlutterGeneratorOptions } from './types';
import {
  createProjectStructure,
  generateModels,
  generateServices,
  generatePages,
  generateNavigation,
  generateConfiguration
} from './projectBuilder';
import { enableFlutterPlatformsAndClean, zipDirectory } from './platformAndPackaging';
import { getRelationsForClass, ProcessedRelation } from './utils/relationMapper';

/**
 * Genera un proyecto Flutter a partir de un diagrama UML serializado (UMLDiagramJSON).
 *
 * Flujo general:
 *  1. Validar el diagrama de entrada.
 *  2. Preparar directorios de salida (generated/<uuid>).
 *  3. Construir un mapa de clases y procesar relaciones entre clases (si las hay).
 *  4. Crear la estructura del proyecto y generar modelos, servicios, páginas y navegación.
 *  5. Configurar las plataformas Flutter (opcional) y empaquetar el proyecto en un ZIP.
 *  6. En caso de error, intenta limpiar el directorio temporal del proyecto y propaga el error.
 *
 * @param diagram - Objeto que representa el diagrama UML (clases, relaciones, nombre, package).
 * @param options - Opciones para la generación (apiBaseUrl, enableWeb, enableWindows, timeoutMs).
 * @returns Ruta absoluta al archivo ZIP generado que contiene el proyecto Flutter.
 * @throws Error si el diagrama no contiene clases válidas o si ocurre un fallo durante la generación.
 */
export async function generateFlutterFromDiagram(
  diagram: UMLDiagramJSON,
  options: FlutterGeneratorOptions = {}
): Promise<string> {
  // Validación básica de entrada
  if (!diagram || !Array.isArray(diagram.classes) || diagram.classes.length === 0) {
    throw new Error('El diagrama debe contener al menos una clase');
  }

  // Valores por defecto para las opciones
  const {
    apiBaseUrl = 'http://localhost:3000',
    enableWeb = true,
    enableWindows = true,
    timeoutMs = 5 * 60 * 1000
  } = options;

  // Generamos un id único para el proyecto generado y determinamos paths de salida
  const projectId = uuidv4();
  const outputDir = path.join(process.cwd(), 'generated'); // carpeta base para artefactos
  const projectDir = path.join(outputDir, projectId); // carpeta del proyecto concreto
  const zipPath = path.join(outputDir, `${projectId}.zip`); // path final del ZIP

  // Crear directorios necesarios (recursive asegura que toda la ruta exista)
  await mkdir(outputDir, { recursive: true });
  await mkdir(projectDir, { recursive: true });

  // Crear un mapa id -> nombre de clase para facilitar resolución de relaciones
  const classesMap = new Map<string, string>();
  diagram.classes.forEach(cls => { if (cls.id) classesMap.set(cls.id, cls.name); });

  // Procesar relaciones por clase usando el mapper especializado
  const relationsMap = new Map<string, ProcessedRelation[]>();
  if (diagram.relations && diagram.relations.length > 0) {
    diagram.classes.forEach(cls => {
      if (cls.id) {
        const relations = getRelationsForClass(cls.name, cls.id, diagram.relations!, classesMap);
        relationsMap.set(cls.name, relations);
      }
    });
  }

  try {
    // Crear estructura base del proyecto (lib/, lib/models, lib/services, etc.)
    await createProjectStructure(projectDir);

    // Generar los artefactos principales en paralelo/orden lógico:
    // modelos, servicios, páginas, navegación y configuración (pubspec, main, README).
    await generateModels(projectDir, diagram.classes, relationsMap);
    await generateServices(projectDir, diagram.classes, apiBaseUrl);
    await generatePages(projectDir, diagram.classes, relationsMap);
    await generateNavigation(projectDir, diagram.classes, diagram.name || 'Mi App');
    // pasar apiBaseUrl (puerto 8080) y timeout en segundos
    await generateConfiguration(
      projectDir,
      diagram.package || (diagram.name || 'mi_app'),
      diagram.name || 'Mi App',
      apiBaseUrl,                      // normalmente 'http://localhost:8080'
      Math.floor(timeoutMs / 1000)
    );

    // Habilitar plataformas necesarias y realizar tareas de empaquetado/limpieza
    await enableFlutterPlatformsAndClean(projectDir, { enableWeb, enableWindows, timeoutMs });

    // Determinar el nombre del proyecto para la carpeta raíz del ZIP
    const projectName = diagram.name || diagram.package || 'flutter-app';
    // Normalizar el nombre del proyecto (eliminar caracteres especiales, espacios, etc.)
    const normalizedProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'flutter-app';

    // Crear archivo ZIP con el proyecto generado (incluyendo carpeta raíz)
    await zipDirectory(projectDir, zipPath, normalizedProjectName);

    // Devolver la ruta del ZIP generado
    return zipPath;
  } catch (err) {
    // En caso de error, intentamos eliminar el directorio del proyecto para no dejar basura.
    // Se usa import dinámico de fs/promises para evitar problemas de carga en algunos entornos.
    try { await import('fs/promises').then(m => m.rm(projectDir, { recursive: true, force: true })); } catch {}
    // Propagar el error original para que el caller lo gestione/loguee
    throw err;
  }
}