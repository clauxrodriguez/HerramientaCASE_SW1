/**
 * Genera un Drawer (sidebar) con navegación por clases
 * Incluye:
 * - Header con título de la app
 * - Lista de items por cada clase
 * - Navegación a páginas de lista
 * - Diseño responsivo
 * 
 * @param classNames - Array de nombres de clases
 * @param appName - Nombre de la aplicación
 * @returns Código Dart del sidebar
 */
export function generateSidebarDart(
  classNames: string[],
  appName: string = 'Mi App'
): string {
  const menuItems = classNames.map(className => {
    const lowerName = className.toLowerCase();
    return `          ListTile(
            leading: const Icon(Icons.list),
            title: Text('${className}s'),
            onTap: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/${lowerName}s');
            },
          ),`;
  }).join('\n');

  return `import 'package:flutter/material.dart';

/// Drawer (sidebar) principal de la aplicación
/// Contiene enlaces de navegación a todas las secciones
class AppDrawer extends StatelessWidget {
  const AppDrawer({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(
              color: Theme.of(context).primaryColor,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                const Icon(
                  Icons.apps,
                  size: 48,
                  color: Colors.white,
                ),
                const SizedBox(height: 8),
                Text(
                  '${appName}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.home),
            title: const Text('Inicio'),
            onTap: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/');
            },
          ),
          const Divider(),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              'Módulos',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.grey,
              ),
            ),
          ),
${menuItems}
          const Divider(),
          ListTile(
            leading: const Icon(Icons.settings),
            title: const Text('Configuración'),
            onTap: () {
              Navigator.pop(context);
              // TODO: Implementar página de configuración
            },
          ),
        ],
      ),
    );
  }
}
`;
}