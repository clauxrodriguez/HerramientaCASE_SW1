import * as path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { UMLClass, UMLAttribute, generateModelDart } from './generators/modelGenerator';
import { generateServiceDart } from './generators/serviceGenerator';
import { generateListPageDart, generateFormPageDart } from './generators/pages/pageGenerator';
import { generateSidebarDart } from './generators/sidebarGenerator';
import { generateRoutesDart } from './generators/routeGenerator';
import { generateHomePageDart } from './generators/widgetGenerator';
import { generatePubspecYaml } from './templates/pubspecTemplate';
import { generateMainDart } from './templates/mainTemplate';
import { ProcessedRelation } from './utils/relationMapper';
import { generateConfigDart } from './generators/configGenerator';

/**
 * Normaliza un nombre de clase a UpperCamelCase (PascalCase)
 * Ejemplos: "PRODUCTO_VENTA_DETALLE" -> "ProductoVentaDetalle", "user_profile" -> "UserProfile"
 */
function normalizeClassName(name: string): string {
  if (!name) return 'GeneratedClass';
  
  // Dividir por guiones bajos, espacios, o cambios de mayúsculas
  const parts = name
    .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase -> snake_case
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  
  return parts.join('');
}

/**
 * Crea la estructura de directorios mínima necesaria para el proyecto Flutter.
 *
 * - lib/models: modelos de datos
 * - lib/services: llamadas a API / lógica de datos
 * - lib/pages: páginas por entidad
 * - lib/widgets: widgets compartidos
 * - test: pruebas
 *
 * @param projectDir Ruta base donde crear la estructura (directorio del proyecto generado)
 */
export async function createProjectStructure(projectDir: string): Promise<void> {
  const dirs = ['lib/models', 'lib/services', 'lib/pages', 'lib/widgets', 'test'];
  // Crear todos los directorios de forma concurrente (recursive para evitar errores si faltan padres)
  await Promise.all(dirs.map(d => mkdir(path.join(projectDir, d), { recursive: true })));
}

/**
 * Genera archivos Dart para cada modelo UML proporcionado.
 *
 * - Usa generateModelDart para convertir la definición de clase + relaciones en código Dart.
 * - Escribe cada modelo en lib/models/<nombre>.dart (nombre en minúsculas).
 *
 * @param projectDir Ruta base del proyecto donde crear lib/models
 * @param classes Array de clases UML a generar
 * @param relationsMap Mapa con relaciones procesadas por clase (puede estar vacío)
 */
export async function generateModels(
  projectDir: string,
  classes: UMLClass[],
  relationsMap: Map<string, ProcessedRelation[]>,
  
): Promise<void> {
  const modelsDir = path.join(projectDir, 'lib/models');
  // Generar modelos en paralelo para mejorar rendimiento
  await Promise.all(classes.map(async (cls) => {
    const normalizedName = normalizeClassName(cls.name);
    const relations = relationsMap.get(cls.name) || [];
    // Crear una copia de la clase con el nombre normalizado
    const normalizedClass = { ...cls, name: normalizedName };
    const modelCode = generateModelDart(normalizedClass, relations);
    // Nombre de archivo: clase normalizada en minúsculas (ej. ProductoVentaDetalle => producto_venta_detalle.dart)
    const fileName = `${normalizedName.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2')}.dart`;
    await writeFile(path.join(modelsDir, fileName), modelCode, 'utf-8');
  }));
}

/**
 * Genera servicios (capa de acceso a datos / API) para cada clase.
 *
 * - Cada servicio se escribe como <clase>_service.dart dentro de lib/services.
 * - generateServiceDart crea el contenido del servicio dado el nombre de la clase y la URL base de la API.
 *
 * @param projectDir Ruta base del proyecto
 * @param classes Clases UML para las que generar servicios
 * @param apiBaseUrl URL base para las llamadas en los servicios generados
 */
export async function generateServices(projectDir: string, classes: UMLClass[], apiBaseUrl: string): Promise<void> {
  const servicesDir = path.join(projectDir, 'lib/services');
  await Promise.all(classes.map(async (cls) => {
    const normalizedName = normalizeClassName(cls.name);
    const serviceCode = generateServiceDart(normalizedName);
    const fileName = `${normalizedName.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2')}_service.dart`;
    await writeFile(path.join(servicesDir, fileName), serviceCode, 'utf-8');
  }));
}

/**
 * Genera páginas (listado y formulario) para cada entidad.
 *
 * - Crea un subdirectorio por clase en lib/pages/<clase>/ con:
 *   - <clase>_list_page.dart
 *   - <clase>_form_page.dart
 * - Los generadores reciben el nombre de la clase y sus atributos para construir los widgets.
 *
 * @param projectDir Ruta base del proyecto
 * @param classes Array de clases UML
 */
export async function generatePages(
  projectDir: string, 
  classes: UMLClass[],
  relationsMap: Map<string, ProcessedRelation[]> = new Map()
): Promise<void> {
  const pagesDir = path.join(projectDir, 'lib/pages');
  await Promise.all(classes.map(async (cls) => {
    const lowerName = cls.name.toLowerCase();
    const classDir = path.join(pagesDir, lowerName);
    // Asegurar que el directorio de la clase exista
    await mkdir(classDir, { recursive: true });

    // Atributos pueden no estar tipados exactamente; se fuerza el cast a UMLAttribute[]
    const attrs = ((cls as any).attributes || []) as UMLAttribute[];

    // Validar que la clase tenga atributos antes de generar páginas
    if (!attrs || attrs.length === 0) {
      console.warn(`⚠️  La clase ${cls.name} no tiene atributos. Se omitirá la generación de páginas para esta clase.`);
      return;
    }

    // Normalizar nombre de clase
    const normalizedName = normalizeClassName(cls.name);
    
    // Obtener relaciones para esta clase (se usa en ambas páginas)
    const relations = relationsMap.get(cls.name) || [];
    
    // Generar página de lista (incluyendo relaciones)
    const listPageCode = generateListPageDart(normalizedName, attrs, relations);
    await writeFile(path.join(classDir, `${lowerName}_list_page.dart`), listPageCode, 'utf-8');

    // Generar página de formulario/edición (incluyendo relaciones)
    const formPageCode = generateFormPageDart(normalizedName, attrs, relations);
    await writeFile(path.join(classDir, `${lowerName}_form_page.dart`), formPageCode, 'utf-8');
  }));
}

/**
 * Genera la navegación y widgets globales del proyecto.
 *
 * - routes.dart en lib/ con las rutas para las páginas generadas.
 * - app_drawer.dart en lib/widgets con un sidebar que lista las entidades.
 * - home_page.dart en lib/pages/home como punto de entrada secundario.
 *
 * @param projectDir Ruta base del proyecto
 * @param classes Array de clases UML (se usa su nombre para construir menús/rutas)
 * @param appName Nombre de la aplicación para títulos y README
 */
export async function generateNavigation(projectDir: string, classes: UMLClass[], appName: string): Promise<void> {
  const libDir = path.join(projectDir, 'lib');
  const widgetsDir = path.join(libDir, 'widgets');
  const homeDir = path.join(libDir, 'pages', 'home');
  // Asegurar directorios existentes
  await mkdir(widgetsDir, { recursive: true });
  await mkdir(homeDir, { recursive: true });

  // Filtrar clases que tienen atributos (solo estas tienen páginas generadas)
  const classesWithAttributes = classes.filter(cls => {
    const attrs = ((cls as any).attributes || []) as UMLAttribute[];
    return attrs && attrs.length > 0;
  });

  const classNames = classesWithAttributes.map(c => normalizeClassName(c.name));
  // Generar rutas y widgets globales
  await writeFile(path.join(libDir, 'routes.dart'), generateRoutesDart(classNames), 'utf-8');
  await writeFile(path.join(widgetsDir, 'app_drawer.dart'), generateSidebarDart(classNames, appName), 'utf-8');
  // Usar nombre de paquete por defecto. Si quieres imports tipo "package:xxx/..." pasa el packageName
  const packageName = 'com_example'; // <- cambiar/propagar desde orchestrator si tienes el package real
  await writeFile(path.join(homeDir, 'home_page.dart'), generateHomePageDart(classNames, appName, packageName), 'utf-8');
}

/**
 * Genera archivos de configuración y metadatos del proyecto.
 *
 * - pubspec.yaml: archivo de dependencias y metadatos del paquete Flutter.
 * - lib/main.dart: entrada principal de la aplicación generada.
 * - analysis_options.yaml: reglas de lint básicas.
 * - README.md: documento mínimo describiendo el proyecto generado.
 *
 * @param projectDir Ruta base del proyecto
 * @param packageName Identificador del paquete (ej. com.example.app) usado en pubspec
 * @param appName Nombre legible de la aplicación
 */
export async function generateConfiguration(
  projectDir: string,
  packageName: string,
  appName: string,
  apiBaseUrl: string = 'http://localhost:8080',
  httpTimeoutSeconds: number = 30
): Promise<void> {
  const libDir = path.join(projectDir, 'lib');
  await mkdir(libDir, { recursive: true });

  // pubspec y main
  await writeFile(path.join(projectDir, 'pubspec.yaml'), generatePubspecYaml(packageName), 'utf-8');
  // generateMainDart actualmente acepta 1 argumento (appName)
  await writeFile(path.join(libDir, 'main.dart'), generateMainDart(appName), 'utf-8');

  // Generar lib/config.dart pasando la URL (incluye puerto 8080)
  await writeFile(path.join(libDir, 'config.dart'), generateConfigDart(apiBaseUrl), 'utf-8');
  // Si quieres usar el timeout también, ajusta generateConfigDart para aceptar el valor o setéalo aquí si es necesario

  // Archivo de reglas de lint/analysis básico
  const analysisOptions = `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    - prefer_const_constructors
    - prefer_const_literals_to_create_immutables
    - avoid_print
`;
  await writeFile(path.join(projectDir, 'analysis_options.yaml'), analysisOptions, 'utf-8');

  // README mínimo que describe el proyecto generado
  const readme = `# ${appName}\n\nProyecto Flutter generado automáticamente desde diagrama UML.\n`;
  await writeFile(path.join(projectDir, 'README.md'), readme, 'utf-8');
}