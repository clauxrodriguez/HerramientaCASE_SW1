/**
 * Genera el archivo pubspec.yaml del proyecto Flutter
 * Incluye dependencias necesarias para:
 * - HTTP requests (http)
 * - Navegación y UI (flutter SDK)
 * 
 * @param appName - Nombre del paquete (formato snake_case)
 * @param description - Descripción del proyecto
 * @returns Contenido del pubspec.yaml
 */
export function generatePubspecYaml(
  appName: string,
  description: string = 'A Flutter application generated from UML diagram'
): string {
  const packageName = appName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  return `name: ${packageName}
description: ${description}

publish_to: 'none'

version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  
  # HTTP client para consumir API REST
  http: ^1.1.0
  
  # Cupertino icons para iOS
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  
  # Linter para análisis estático
  flutter_lints: ^2.0.0

flutter:
  uses-material-design: true
  
  # Assets (descomentar si se añaden imágenes/fuentes)
  # assets:
  #   - images/
  
  # fonts:
  #   - family: Schyler
  #     fonts:
  #       - asset: fonts/Schyler-Regular.ttf
`;
}