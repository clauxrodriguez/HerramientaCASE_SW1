/**
 * Mapea tipos UML/Java a tipos Dart nativos
 * @param umlType - Tipo en formato UML (String, Long, etc.)
 * @returns Tipo equivalente en Dart
 */
export function mapUmlTypeToDart(umlType: string): string {
  const normalized = (umlType || '').toLowerCase().trim();
  
  // Tipos primitivos
  const typeMap: Record<string, string> = {
    // Strings
    'string': 'String',
    'char': 'String',
    'varchar': 'String',
    'text': 'String',
    
    // Números enteros
    'long': 'int',
    'integer': 'int',
    'int': 'int',
    'short': 'int',
    
    // Números decimales
    'bigdecimal': 'double',
    'decimal': 'double',
    'double': 'double',
    'float': 'double',
    
    // Fechas
    'localdatetime': 'DateTime',
    'datetime': 'DateTime',
    'date': 'DateTime',
    'timestamp': 'DateTime',
    'localdate': 'DateTime',
    
    // Booleanos
    'boolean': 'bool',
    'bool': 'bool',
  };

  if (typeMap[normalized]) {
    return typeMap[normalized];
  }

  // Si empieza con mayúscula, es un modelo personalizado
  if (/^[A-Z]/.test(umlType)) {
    return umlType;
  }

  // Fallback
  return 'String';
}

/**
 * Genera valor por defecto para un tipo Dart
 * @param dartType - Tipo Dart (String, int, etc.)
 * @param nullable - Si el campo es nullable
 * @returns Valor por defecto apropiado
 */
export function getDefaultValue(dartType: string, nullable: boolean): string {
  if (nullable) return 'null';

  const defaults: Record<string, string> = {
    'String': "''",
    'int': '0',
    'double': '0.0',
    'bool': 'false',
    'DateTime': 'DateTime.now()',
  };

  return defaults[dartType] || 'null';
}

/**
 * Genera código de parsing para fromJson según el tipo
 * @param fieldName - Nombre del campo
 * @param dartType - Tipo Dart del campo
 * @param nullable - Si es nullable
 * @returns Código Dart para parsear desde JSON
 */
export function generateFromJsonCode(
  fieldName: string, 
  dartType: string, 
  nullable: boolean
): string {
  const jsonKey = `json['${fieldName}']`;
  const fallback = getDefaultValue(dartType, nullable);

  if (dartType === 'int') {
    return nullable
      ? `${jsonKey} != null ? (${jsonKey} is num ? (${jsonKey} as num).toInt() : int.tryParse(${jsonKey}.toString())) : null`
      : `${jsonKey} != null ? (${jsonKey} is num ? (${jsonKey} as num).toInt() : int.tryParse(${jsonKey}.toString()) ?? 0) : 0`;
  }

  if (dartType === 'double') {
    return nullable
      ? `${jsonKey} != null ? (${jsonKey} is num ? (${jsonKey} as num).toDouble() : double.tryParse(${jsonKey}.toString())) : null`
      : `${jsonKey} != null ? (${jsonKey} is num ? (${jsonKey} as num).toDouble() : double.tryParse(${jsonKey}.toString()) ?? 0.0) : 0.0`;
  }

  if (dartType === 'bool') {
    return nullable
      ? `${jsonKey} != null ? (${jsonKey} is bool ? ${jsonKey} : ${jsonKey}.toString().toLowerCase() == 'true') : null`
      : `${jsonKey} != null ? (${jsonKey} is bool ? ${jsonKey} : ${jsonKey}.toString().toLowerCase() == 'true') : false`;
  }

  if (dartType === 'DateTime') {
    return nullable
      ? `${jsonKey} != null ? DateTime.parse(${jsonKey}.toString()) : null`
      : `${jsonKey} != null ? DateTime.parse(${jsonKey}.toString()) : DateTime.now()`;
  }

  if (dartType === 'String') {
    return nullable
      ? `${jsonKey}?.toString()`
      : `${jsonKey}?.toString() ?? ''`;
  }

  // Tipo personalizado (modelo)
  return nullable
    ? `${jsonKey} != null ? ${dartType}.fromJson(${jsonKey}) : null`
    : `${dartType}.fromJson(${jsonKey} ?? {})`;
}

/**
 * Genera código de serialización para toJson según el tipo
 * @param fieldName - Nombre del campo
 * @param dartType - Tipo Dart del campo
 * @returns Código Dart para serializar a JSON
 */
export function generateToJsonCode(fieldName: string, dartType: string): string {
  if (dartType === 'DateTime') {
    return `${fieldName}?.toIso8601String()`;
  }

  // Tipo personalizado (modelo)
  if (!/^(String|int|double|bool)$/.test(dartType)) {
    return `${fieldName}?.toJson()`;
  }

  return fieldName;
}