/**
 * Módulo responsable de tareas relacionadas con plataformas Flutter y empaquetado.
 *
 * Funcionalidades principales:
 * - Delegar la habilitación de plataformas Flutter (p.ej. web/windows) a enablePlatforms.
 * - Empaquetar un directorio de proyecto en un ZIP listo para descarga/entrega.
 *
 * Nota: este módulo no modifica el contenido del proyecto, solo orquesta llamadas
 * a herramientas externas y genera el archivo ZIP final.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import archiver from 'archiver';
import { enableFlutterPlatforms } from './enablePlatforms';

// promisify para compatibilidad con API basada en callbacks (mkdir)
const mkdir = promisify(fs.mkdir);

/**
 * Llama a la rutina que habilita plataformas Flutter para el proyecto.
 *
 * Se espera que enableFlutterPlatforms realice las llamadas necesarias al CLI de flutter
 * (por ejemplo `flutter create` o `flutter config`) y maneje sus propios errores/tiempos.
 * Esta función actúa como envoltorio donde, si se requiere, se podría añadir lógica
 * adicional de limpieza, timeouts o retries.
 *
 * @param projectDir Ruta absoluta del directorio del proyecto Flutter generado.
 * @param opts Opciones para la habilitación de plataformas:
 *  - enableWeb: si habilitar la plataforma web
 *  - enableWindows: si habilitar la plataforma Windows
 *  - timeoutMs: tiempo máximo permitido para las operaciones externas (si se implementa)
 */
export async function enableFlutterPlatformsAndClean(
  projectDir: string,
  opts: { enableWeb: boolean; enableWindows: boolean; timeoutMs: number; }
) {
  // Delegamos la responsabilidad a enableFlutterPlatforms.
  // enableFlutterPlatforms debe lanzar en caso de fallo para que el caller lo maneje.
  await enableFlutterPlatforms(projectDir, opts);
}

/**
 * Crea un archivo ZIP con el contenido de un directorio.
 *
 * Implementación basada en streams y la librería `archiver`:
 * - Se crea un WriteStream hacia el archivo de salida.
 * - Se instancia `archiver('zip')` y se añade el directorio fuente.
 * - Se resuelve la promesa cuando el stream de salida emite 'close'.
 * - Se rechaza en caso de error del archivador.
 *
 * @param sourceDir Ruta al directorio que se quiere comprimir.
 * @param outPath Ruta del archivo ZIP de salida a crear.
 * @param projectName Nombre de la carpeta raíz dentro del ZIP (opcional, por defecto usa el nombre del directorio).
 * @returns Promise que se resuelve al completar la creación del ZIP.
 */
export async function zipDirectory(sourceDir: string, outPath: string, projectName?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Stream hacia el ZIP destino
    const output = fs.createWriteStream(outPath);
    // Archiver configurado con nivel máximo de compresión
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Cuando el stream se cierra, consideramos que la operación finalizó correctamente
    output.on('close', () => resolve());

    // Propagar errores del archivador/readdir
    archive.on('error', (err) => reject(err));

    // Conectar el archivador al stream de salida
    archive.pipe(output);

    // Incluir todo el contenido del directorio fuente en el ZIP
    // Si se proporciona projectName, se usa como carpeta raíz; si no, se usa el nombre del directorio
    const rootFolderName = projectName || path.basename(sourceDir);
    archive.directory(sourceDir, rootFolderName);

    // Finalizar la creación del ZIP (flush + close)
    archive.finalize();
  });
}