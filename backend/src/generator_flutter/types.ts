/**
 * Representa el diagrama UML serializado que alimenta el generador Flutter.
 *
 * - `package`: identificador de paquete/namespace opcional (ej. "com.example.app").
 * - `name`: nombre del diagrama/proyecto (usado como appName si no se provee package).
 * - `classes`: lista de clases UML con atributos y métodos mínimos esperados.
 * - `relations`: lista genérica de relaciones entre clases (formato dependiente del mapper).
 */
export interface UMLDiagramJSON {
  /**
   * Identificador del paquete para el proyecto Flutter (opcional).
   * Ejemplo: "com.example.app"
   */
  package?: string;

  /**
   * Nombre legible del diagrama / aplicación.
   * Se usa como título en la app y README cuando no se provée package.
   */
  name?: string;

  /**
   * Array de clases que conforman el diagrama.
   * Cada clase puede tener:
   *  - id: identificador único (útil para resolver relaciones)
   *  - name: nombre de la clase
   *  - attributes: lista de atributos (estructura libre, depende del exportador UML)
   *  - methods: lista opcional de métodos con nombre, tipo de retorno y parámetros
   */
  classes: Array<{
    id?: string;
    name: string;
    attributes: any[];
    methods?: Array<{ name: string; returnType: string; parameters?: any[] }>;
  }>;

  /**
   * Relaciones entre clases (formatos diversos según el origen).
   * El contenido se procesa mediante los mappers del generador (relationMapper).
   */
  relations?: Array<any>;
}

/**
 * Opciones que controlan el comportamiento del generador Flutter.
 *
 * - `apiBaseUrl`: URL base para generar servicios/consumo de API.
 * - `enableWeb` / `enableWindows`: flags para habilitar plataformas Flutter adicionales.
 * - `timeoutMs`: tiempo máximo (ms) para operaciones externas (p. ej. llamadas al CLI de flutter).
 */
export interface FlutterGeneratorOptions {
  /**
   * URL base usada por los servicios generados para realizar llamadas HTTP.
   * Por defecto: 'http://localhost:3000' (si no se provee en el orchestrator).
   */
  apiBaseUrl?: string;

  /**
   * Habilitar generación/configuración para la plataforma web.
   */
  enableWeb?: boolean;

  /**
   * Habilitar generación/configuración para la plataforma Windows.
   */
  enableWindows?: boolean;

  /**
   * Timeout en milisegundos para operaciones externas relacionadas con la habilitación de plataformas.
   */
  timeoutMs?: number;
}