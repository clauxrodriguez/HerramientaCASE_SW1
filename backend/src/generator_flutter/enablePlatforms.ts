import { spawn, execSync } from 'child_process';
import path from 'path';

/**
 * Verifica si Flutter está disponible en el sistema.
 * @returns true si Flutter está instalado y disponible en PATH
 */
function isFlutterAvailable(): boolean {
  try {
    execSync('flutter --version', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * enableFlutterPlatforms
 * - Ejecuta los comandos necesarios para habilitar web/desktop y generar
 *   los ficheros de plataforma con `flutter create .` en projectDir.
 * - Si Flutter no está disponible, emite una advertencia y continúa sin fallar.
 * - Requiere que `flutter` esté en PATH para habilitar plataformas.
 */
export function enableFlutterPlatforms(projectDir: string, options?: { enableWeb?: boolean; enableWindows?: boolean; timeoutMs?: number }): Promise<void> {
  // Verificar si Flutter está disponible
  if (!isFlutterAvailable()) {
    console.warn('[Flutter Generator] ⚠️  Flutter CLI no está disponible en el sistema.');
    console.warn('[Flutter Generator] ⚠️  Se omitirá la habilitación de plataformas.');
    console.warn('[Flutter Generator] ℹ️  El proyecto generado seguirá siendo funcional.');
    console.warn('[Flutter Generator] ℹ️  Para habilitar plataformas, ejecuta manualmente: flutter create .');
    return Promise.resolve(); // Continuar sin fallar
  }

  const enableWeb = options?.enableWeb ?? true;
  const enableWindows = options?.enableWindows ?? true;
  const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000; // 5 min por defecto

  // Construir comando compuesto para shell (Windows compat.)
  const cmds: string[] = [];
  if (enableWeb) cmds.push('flutter config --enable-web');
  if (enableWindows) cmds.push('flutter config --enable-windows-desktop');
  // `flutter create .` añadirá los directorios de plataforma faltantes
  cmds.push('flutter create .');

  const fullCmd = cmds.join(' && ');
  return new Promise((resolve, reject) => {
    const proc = spawn(fullCmd, {
      cwd: projectDir,
      shell: true,
      env: process.env,
    });

    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`enableFlutterPlatforms timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout?.on('data', (d) => process.stdout.write(`[flutter] ${d}`));
    proc.stderr?.on('data', (d) => process.stderr.write(`[flutter] ${d}`));

    proc.on('error', (err) => {
      clearTimeout(killTimer);
      // Si el error es porque Flutter no está disponible, solo advertir y continuar
      if (err.message && (err.message.includes('ENOENT') || err.message.includes('no se reconoce'))) {
        console.warn('[Flutter Generator] ⚠️  Flutter CLI no está disponible. Se omitirá la habilitación de plataformas.');
        resolve(); // Continuar sin fallar
      } else {
        reject(err);
      }
    });

    proc.on('close', (code) => {
      clearTimeout(killTimer);
      if (code === 0) {
        resolve();
      } else {
        // Si el código de salida no es 0, advertir pero no fallar
        console.warn(`[Flutter Generator] ⚠️  Comandos de Flutter terminaron con código ${code}.`);
        console.warn('[Flutter Generator] ℹ️  El proyecto se generará sin habilitar plataformas automáticamente.');
        resolve(); // Continuar sin fallar
      }
    });
  });
}