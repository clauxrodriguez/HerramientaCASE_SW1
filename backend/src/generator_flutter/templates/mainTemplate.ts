/**
 * Genera el archivo main.dart principal
 * Configura MaterialApp con tema y rutas
 * 
 * @param appName - Nombre de la aplicación
 * @returns Código Dart del main.dart
 */
export function generateMainDart(appName: string = 'Mi App', packageName: string = 'com_example'): string {
  // color naranja cálido (puedes ajustar el hex)
  const seedHex = '#FF8A65'; // naranja cálido (deep orange light)
  return `import 'package:flutter/material.dart';
import 'config.dart';
import 'routes.dart';
import 'pages/home/home_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.validateConfig();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final seedColor = const Color(0xFFFF8A65); // naranja cálido
    return MaterialApp(
      title: '${appName}',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: seedColor, brightness: Brightness.light),
        primaryColor: seedColor,
        // fondo suave naranja claro para toda la app
        scaffoldBackgroundColor: const Color(0xFFFFF3E6),
        // AppBar transparente y sin elevación para evitar la franja blanca
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
          centerTitle: false,
          foregroundColor: Colors.black87,
        ),
        floatingActionButtonTheme: FloatingActionButtonThemeData(
          backgroundColor: seedColor,
          foregroundColor: Colors.white,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(backgroundColor: seedColor),
        ),
      ),
      home: const HomePage(),
      routes: buildAppRoutes(),
    );
  }
}
`;
}