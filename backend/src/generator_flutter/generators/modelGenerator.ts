import { mapUmlTypeToDart, generateFromJsonCode, generateToJsonCode } from '../utils/typeMapper';
import { ProcessedRelation } from '../utils/relationMapper';

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
 * Representa un atributo de clase UML
 */
export interface UMLAttribute {
  name: string;
  type: string;
  nullable?: boolean;
  unique?: boolean;
  isId?: boolean;
}

/**
 * Detecta si un atributo es un ID por nombre o por la propiedad isId
 * @param attr - Atributo a verificar
 * @returns true si el atributo es un ID
 */
function isIdAttribute(attr: UMLAttribute): boolean {
  if (attr.isId) return true;
  
  // Detectar IDs por nombre común (case-insensitive)
  const nameLower = attr.name.toLowerCase();
  const idPatterns = [
    /^id$/,           // "id", "Id", "ID"
    /^id[a-z0-9]/,    // "idFactura", "idProducto", "id123"
    /^[a-z0-9]*id$/,  // "userId", "productId", "userid"
    /^id_[a-z0-9]/,   // "id_user", "id_producto"
  ];
  
  return idPatterns.some(pattern => pattern.test(nameLower));
}

/**
 * Representa una clase UML completa
 */
export interface UMLClass {
  id?: string;
  name: string;
  attributes: UMLAttribute[];
  methods?: Array<{ name: string; returnType: string; parameters?: any[] }>;
}

/**
 * Genera un modelo Dart completo con:
 * - Campos de la clase
 * - Campos de relaciones
 * - Constructor con parámetros nombrados
 * - factory fromJson()
 * - Map<String, dynamic> toJson()
 * - copyWith() para inmutabilidad
 * 
 * @param umlClass - Clase UML del diagrama
 * @param relations - Relaciones procesadas donde esta clase es origen
 * @returns Código Dart del modelo
 */
export function generateModelDart(
  umlClass: UMLClass,
  relations: ProcessedRelation[] = []
): string {
  // Normalizar nombre de clase a UpperCamelCase
  const className = normalizeClassName(umlClass.name);
  const attributes = umlClass.attributes || [];
  
  // Verificar si la clase tiene campos (atributos o relaciones)
  const hasFields = attributes.length > 0 || relations.length > 0;

  // ============ CAMPOS ============
  
  const attributeFields = attributes.map(attr => {
    const isId = isIdAttribute(attr);
    const dartType = mapUmlTypeToDart(attr.type);
    // Si es ID lo tratamos como nullable para permitir creación sin id
    const nullSuffix = (attr.nullable || isId) ? '?' : '';
    const comment = isId ? '  /// Identificador único\n' : '';
    return `${comment}  final ${dartType}${nullSuffix} ${attr.name};`;
  });

  const relationFields = relations.map(rel => {
    const nullSuffix = rel.nullable ? '?' : '';
    return `  /// Relación con ${rel.targetClass}\n  final ${rel.dartType}${nullSuffix} ${rel.fieldName};`;
  });

  const allFields = [...attributeFields, ...relationFields].join('\n');
  
  // Si no hay campos, agregar un campo mínimo para evitar errores de sintaxis
  const fieldsContent = hasFields ? allFields : '  // Clase sin atributos ni relaciones (tabla intermedia)';

  // ============ CONSTRUCTOR ============
  
  const attributeParams = attributes.map(attr => {
    const isId = isIdAttribute(attr);
    const required = (attr.nullable || isId) ? '' : 'required ';
    return `    ${required}this.${attr.name},`;
  });

  const relationParams = relations.map(rel => {
    const required = rel.nullable ? '' : 'required ';
    return `    ${required}this.${rel.fieldName},`;
  });

  const allParams = [...attributeParams, ...relationParams].join('\n');
  
  // Si no hay parámetros, el constructor debe estar vacío pero válido
  const constructorParams = hasFields ? allParams : '';

  // ============ FROM JSON ============
  
  const attributesFromJson = attributes.map(attr => {
    const dartType = mapUmlTypeToDart(attr.type);
    const code = generateFromJsonCode(attr.name, dartType, attr.nullable ?? false);
    return `      ${attr.name}: ${code},`;
  });

  const relationsFromJson = relations.map(rel => {
    if (rel.isList) {
      // Lista de modelos: parsear cada elemento
      const targetClass = rel.targetClass;
      return rel.nullable
        ? `      ${rel.fieldName}: json['${rel.fieldName}'] != null ? (json['${rel.fieldName}'] as List).map((e) => ${targetClass}.fromJson(e)).toList() : null,`
        : `      ${rel.fieldName}: json['${rel.fieldName}'] != null ? (json['${rel.fieldName}'] as List).map((e) => ${targetClass}.fromJson(e)).toList() : [],`;
    } else {
      // Modelo único
      return rel.nullable
        ? `      ${rel.fieldName}: json['${rel.fieldName}'] != null ? ${rel.targetClass}.fromJson(json['${rel.fieldName}']) : null,`
        : `      ${rel.fieldName}: ${rel.targetClass}.fromJson(json['${rel.fieldName}'] ?? {}),`;
    }
  });

  const allFromJson = [...attributesFromJson, ...relationsFromJson].join('\n');
  const fromJsonContent = hasFields ? allFromJson : '';

  // ============ TO JSON ============
  
  const attributesToJson = attributes.map(attr => {
    const dartType = mapUmlTypeToDart(attr.type);
    const code = generateToJsonCode(attr.name, dartType);
    return `      '${attr.name}': ${code},`;
  });

  const relationsToJson = relations.map(rel => {
    if (rel.isList) {
      return `      '${rel.fieldName}': ${rel.fieldName}?.map((e) => e.toJson()).toList(),`;
    } else {
      return `      '${rel.fieldName}': ${rel.fieldName}?.toJson(),`;
    }
  });

  const allToJson = [...attributesToJson, ...relationsToJson].join('\n');
  const toJsonContent = hasFields ? allToJson : '';

  // ============ COPY WITH ============
  
  const copyWithParams = [
    ...attributes.map(attr => {
      const dartType = mapUmlTypeToDart(attr.type);
      const nullSuffix = attr.nullable ? '?' : '';
      return `    ${dartType}${nullSuffix}? ${attr.name},`;
    }),
    ...relations.map(rel => {
      const nullSuffix = rel.nullable ? '?' : '';
      return `    ${rel.dartType}${nullSuffix}? ${rel.fieldName},`;
    })
  ].join('\n');

  const copyWithAssignments = [
    ...attributes.map(attr => `      ${attr.name}: ${attr.name} ?? this.${attr.name},`),
    ...relations.map(rel => `      ${rel.fieldName}: ${rel.fieldName} ?? this.${rel.fieldName},`)
  ].join('\n');
  
  const copyWithParamsContent = hasFields ? copyWithParams : '';
  const copyWithAssignmentsContent = hasFields ? copyWithAssignments : '';

  // ============ TEMPLATE FINAL ============
  
  // Generar toString, operator ==, y hashCode
  // Si no hay atributos, usar implementaciones por defecto
  const toStringContent = hasFields && attributes.length > 0
    ? `'${className}(${attributes.map(a => `${a.name}: \$${a.name}`).join(', ')})'`
    : `'${className}()'`;
  
  const equalsContent = hasFields && attributes.length > 0
    ? `other is ${className} && ${attributes.map(a => `other.${a.name} == ${a.name}`).join(' && ')}`
    : `other is ${className}`;
  
  const hashCodeContent = hasFields && attributes.length > 0
    ? `Object.hash(${attributes.map(a => a.name).join(', ')})`
    : `0`;

  return `/// Modelo generado: ${className}
/// Representa una entidad del dominio con sus atributos y relaciones
class ${className} {
${fieldsContent}

  /// Constructor con parámetros nombrados
  const ${className}({
${constructorParams}
  });

  /// Crea una instancia desde un mapa JSON
  factory ${className}.fromJson(Map<String, dynamic> json) {
    return ${className}(
${fromJsonContent}
    );
  }

  /// Convierte la instancia a un mapa JSON
  Map<String, dynamic> toJson() {
    return {
${toJsonContent}
    };
  }

  /// Crea una copia con campos modificados (inmutabilidad)
  ${className} copyWith({
${copyWithParamsContent}
  }) {
    return ${className}(
${copyWithAssignmentsContent}
    );
  }

  @override
  String toString() => ${toStringContent};

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return ${equalsContent};
  }

  @override
  int get hashCode => ${hashCodeContent};
}
`;
}