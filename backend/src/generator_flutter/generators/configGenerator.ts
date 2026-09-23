/**
 * Genera el archivo de configuración centralizada para la app Flutter
 * Contiene constantes globales como API base URL, timeouts, etc.
 */

export function generateConfigDart(apiBaseUrl: string = 'http://localhost:8080'): string {
  return `/// Configuración centralizada de la aplicación Flutter
/// Todas las constantes globales y URLs de API se definen aquí
class AppConfig {
  /// URL base de la API Spring Boot - Cambiar según el entorno
  static const String baseUrl = '${apiBaseUrl}';
  
  /// Timeout para peticiones HTTP en segundos
  static const int httpTimeout = 30;
  
  /// Encabezados comunes para todas las peticiones HTTP
  static const Map<String, String> defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  /// Configuración de paginación por defecto
  static const int defaultPageSize = 20;
  
  /// Configuración de reintentos para peticiones fallidas
  static const int maxRetries = 3;
  
  /// URLs completas de los endpoints (calculadas dinámicamente)
  static String getApiUrl(String endpoint) {
    // Remover slash inicial del endpoint si existe
    final cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return '\$baseUrl/api/\$cleanEndpoint';
  }
  
  /// Validar que la configuración sea correcta
  static void validateConfig() {
    assert(baseUrl.isNotEmpty, 'Base URL no puede estar vacía');
    assert(baseUrl.startsWith('http'), 'Base URL debe empezar con http:// o https://');
  }
}
`;
}