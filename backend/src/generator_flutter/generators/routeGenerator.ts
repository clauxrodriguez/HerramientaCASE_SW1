/**
 * Genera el archivo de rutas de la aplicación
 * Define todas las rutas disponibles con MaterialPageRoute
 * 
 * @param classNames - Array de nombres de clases
 * @returns Código Dart del generador de rutas
 */
export function generateRoutesDart(classNames: string[]): string {
  // Normalizar y filtrar nombres válidos
  const validNames = (classNames || [])
    .map(n => String(n || '').trim())
    .filter(n => n.length > 0);

  // Helpers para safe identifiers / paths
  const makeLower = (n: string) =>
    n.replace(/[^\w\s]/g, '').replace(/\s+/g, '_').toLowerCase();

  const toPascal = (n: string) =>
    n
      .replace(/[^\w\s]/g, ' ')
      .split(/[\s_]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

  if (validNames.length === 0) {
    return `import 'package:flutter/material.dart';

/// Rutas generadas automáticamente (ninguna clase encontrada)
Map<String, WidgetBuilder> buildAppRoutes() {
  return {
    '/': (context) => const Scaffold(body: Center(child: Text('No pages generated'))),
  };
}
`;
  }

  // Imports para las páginas de lista (rutas principales)
  const imports = validNames.map(cls => {
    const lower = makeLower(cls);
    return `import 'pages/${lower}/${lower}_list_page.dart';`;
  }).join('\n');

  // Entradas del mapa de rutas (NOTA: no generamos '/' ya que main.dart define home)
  const routesEntries = validNames.map(cls => {
    const pascal = toPascal(cls);
    const lower = makeLower(cls);
    return `    '/${lower}s': (context) => ${pascal}ListPage(),`;
  }).join('\n');

  return `import 'package:flutter/material.dart';
${imports}

/// Rutas generadas automáticamente
/// Devuelve el mapa de rutas utilizado por MaterialApp
Map<String, WidgetBuilder> buildAppRoutes() {
  return {
${routesEntries}
  };
}
`;
}