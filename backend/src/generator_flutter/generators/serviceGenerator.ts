// Agrega estas funciones al principio de serviceGenerator.ts
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toLowerCase();
}

function pluralizeKebab(name: string): string {
  const kebab = toKebabCase(name);
  // Reglas básicas de pluralización en inglés
  if (kebab.endsWith('y')) return kebab.slice(0, -1) + 'ies';
  if (kebab.endsWith('s') || kebab.endsWith('x') || kebab.endsWith('z') || 
      kebab.endsWith('ch') || kebab.endsWith('sh')) {
    return kebab + 'es';
  }
  return kebab + 's';
}

export function generateServiceDart(entityName: string): string {
  // entityName ya viene normalizado (UpperCamelCase)
  const entity = entityName;
  // Convertir a snake_case para nombres de archivo
  const entityLower = entityName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  const route = pluralizeKebab(entityName);

  return `import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/${entityLower}.dart';
import '../config.dart';  // ← IMPORTAR CONFIG

class ${entity}Service {
  // ✅ QUITAR baseUrl - ya no es necesario
  ${entity}Service();  // ✅ CONSTRUCTOR SIMPLIFICADO

  String get _endpoint => AppConfig.getApiUrl('${route}');

  // CREATE
  Future<${entity}?> create(${entity} item) async {
    try {
      final requestData = item.toJson();
      requestData.remove('id');
      requestData.remove('createdAt');
      requestData.remove('updatedAt');

      final res = await http.post(
        Uri.parse(_endpoint),
        headers: AppConfig.defaultHeaders,  // ✅ HEADERS DESDE CONFIG
        body: jsonEncode(requestData),
      ).timeout(const Duration(seconds: AppConfig.httpTimeout));
      
      if (res.statusCode == 201) {
        return ${entity}.fromJson(jsonDecode(res.body));
      }
      throw Exception('Error creando ${entity}: \${res.statusCode}');
    } catch (e) {
      throw Exception('Error en create: \$e');
    }
  }

  // READ ALL
  // Incluye relaciones en la consulta usando parámetro ?include= para cargar datos relacionados
  Future<List<${entity}>> list({List<String>? includeRelations}) async {
    try {
      // Construir URL con parámetros de relaciones si se proporcionan
      String url = _endpoint;
      if (includeRelations != null && includeRelations.isNotEmpty) {
        final includeParam = includeRelations.join(',');
        url = '\${_endpoint}?include=\${includeParam}';
      }
      
      final res = await http.get(
        Uri.parse(url),
        headers: AppConfig.defaultHeaders,  // ✅ HEADERS DESDE CONFIG
      ).timeout(const Duration(seconds: AppConfig.httpTimeout));
      
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body) as List;
        return data.map((e) => ${entity}.fromJson(e)).toList();
      }
      throw Exception('Error listando ${entity}: \${res.statusCode}');
    } catch (e) {
      throw Exception('Error en list: \$e');
    }
  }

  // READ BY ID
  // Incluye relaciones en la consulta usando parámetro ?include= para cargar datos relacionados
  Future<${entity}?> getById(dynamic id, {List<String>? includeRelations}) async {
    try {
      // Construir URL con parámetros de relaciones si se proporcionan
      String url = '\${_endpoint}/\$id';
      if (includeRelations != null && includeRelations.isNotEmpty) {
        final includeParam = includeRelations.join(',');
        url = '\${_endpoint}/\$id?include=\${includeParam}';
      }
      
      final res = await http.get(
        Uri.parse(url),
        headers: AppConfig.defaultHeaders,  // ✅ HEADERS DESDE CONFIG
      ).timeout(const Duration(seconds: AppConfig.httpTimeout));
      
      if (res.statusCode == 200) {
        return ${entity}.fromJson(jsonDecode(res.body));
      }
      if (res.statusCode == 404) return null;
      throw Exception('Error obteniendo ${entity} (\$id): \${res.statusCode}');
    } catch (e) {
      throw Exception('Error en getById: \$e');
    }
  }

  // UPDATE
  Future<${entity}?> update(dynamic id, ${entity} item) async {
    try {
      final requestData = item.toJson();
      requestData.remove('id');
      requestData.remove('createdAt');

      final res = await http.put(
        Uri.parse('\${_endpoint}/\$id'),
        headers: AppConfig.defaultHeaders,  // ✅ HEADERS DESDE CONFIG
        body: jsonEncode(requestData),
      ).timeout(const Duration(seconds: AppConfig.httpTimeout));
      
      if (res.statusCode == 200) {
        return ${entity}.fromJson(jsonDecode(res.body));
      }
      throw Exception('Error actualizando ${entity} (\$id): \${res.statusCode}');
    } catch (e) {
      throw Exception('Error en update: \$e');
    }
  }

  // DELETE
  Future<void> delete(dynamic id) async {
    try {
      final res = await http.delete(
        Uri.parse('\${_endpoint}/\$id'),
        headers: AppConfig.defaultHeaders,  // ✅ HEADERS DESDE CONFIG
      ).timeout(const Duration(seconds: AppConfig.httpTimeout));
      
      if (res.statusCode != 204 && res.statusCode != 200) {
        throw Exception('Error eliminando ${entity} (\$id): \${res.statusCode}');
      }
    } catch (e) {
      throw Exception('Error en delete: \$e');
    }
  }

  // BÚSQUEDA POR EJEMPLO
  Future<List<${entity}>> searchByExample(Map<String, dynamic> example) async {
    try {
      final res = await http.post(
        Uri.parse('\${_endpoint}/search'),
        headers: AppConfig.defaultHeaders,  // ✅ HEADERS DESDE CONFIG
        body: jsonEncode(example),
      ).timeout(const Duration(seconds: AppConfig.httpTimeout));
      
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body) as List;
        return data.map((e) => ${entity}.fromJson(e)).toList();
      }
      throw Exception('Error en búsqueda: \${res.statusCode}');
    } catch (e) {
      throw Exception('Error en searchByExample: \$e');
    }
  }
}
`;
}