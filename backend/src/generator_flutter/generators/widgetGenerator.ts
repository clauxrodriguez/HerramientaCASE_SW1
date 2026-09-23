/**
 * Genera la página de inicio (HomePage)
 * Muestra un dashboard con acceso rápido a todas las secciones
 * 
 * @param classNames - Array de nombres de clases
 * @param appName - Nombre de la aplicación
 * @returns Código Dart de la página de inicio
 */
export function generateHomePageDart(
  classNames: string[],
  appName: string = 'Mi App',
  packageName: string = 'com_example'
): string {
  const cards = classNames.map(className => {
    const lowerName = className.toLowerCase().replace(/[^\w]/g, '_');
    return `          _buildModuleCard(
            context,
            title: '${className}s',
            icon: Icons.list,
            route: '/${lowerName}s',
          ),`;
  }).join('\n');

  return `import 'package:flutter/material.dart';
import 'package:${packageName}/widgets/app_drawer.dart';

/// Página principal de la aplicación
/// Muestra un dashboard con acceso rápido a todos los módulos
class HomePage extends StatelessWidget {
  const HomePage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // AppBar transparente para integrarse con el fondo y evitar franja blanca
      appBar: AppBar(
        title: Text('${appName}'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
      ),
      drawer: const AppDrawer(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bienvenido',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Selecciona un módulo para comenzar',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                mainAxisSpacing: 16,
                crossAxisSpacing: 16,
                children: [
${cards}
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModuleCard(
    BuildContext context, {
    required String title,
    required IconData icon,
    required String route,
  }) {
    return Card(
      elevation: 4,
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, route),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 48, color: Theme.of(context).primaryColor),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
`;
}