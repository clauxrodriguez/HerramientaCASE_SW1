/**
 * Tipos de relaciones UML soportadas
 */
export type RelationType = 
  | 'ONE_TO_ONE' 
  | 'ONE_TO_MANY' 
  | 'MANY_TO_ONE' 
  | 'MANY_TO_MANY'
  | 'INHERITANCE'
  | 'COMPOSITION'
  | 'AGGREGATION';

/**
 * Información de una relación procesada para Flutter
 */
export interface ProcessedRelation {
  fieldName: string;
  dartType: string;
  isList: boolean;
  nullable: boolean;
  targetClass: string;
}

/**
 * Procesa una relación UML y devuelve información para generar código Dart
 * 
 * @param relation - Relación UML del diagrama
 * @param sourceClassName - Nombre de la clase origen
 * @param targetClassName - Nombre de la clase destino
 * @returns Información procesada para la generación
 */
export function processRelation(
  relation: {
    type: RelationType;
    source: string;
    target: string;
    sourceCardinality?: string;
    targetCardinality?: string;
    mappedBy?: string;
    label?: string;
  },
  sourceClassName: string,
  targetClassName: string
): ProcessedRelation | null {
  const { type, mappedBy, label } = relation;

  // Determinar nombre del campo (usa mappedBy, label, o nombre de clase en minúscula)
  let fieldName = mappedBy || label || targetClassName.toLowerCase();
  
  // Normalizar nombre de campo (camelCase)
  fieldName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);

  switch (type) {
    case 'ONE_TO_ONE':
      return {
        fieldName,
        dartType: targetClassName,
        isList: false,
        nullable: true, // ONE_TO_ONE suele ser nullable
        targetClass: targetClassName
      };

    case 'ONE_TO_MANY':
      return {
        fieldName: fieldName.endsWith('s') ? fieldName : `${fieldName}s`,
        dartType: `List<${targetClassName}>`,
        isList: true,
        nullable: false, // Lista vacía por defecto
        targetClass: targetClassName
      };

    case 'MANY_TO_ONE':
      return {
        fieldName,
        dartType: targetClassName,
        isList: false,
        nullable: false, // Generalmente requerido
        targetClass: targetClassName
      };

    case 'MANY_TO_MANY':
      return {
        fieldName: fieldName.endsWith('s') ? fieldName : `${fieldName}s`,
        dartType: `List<${targetClassName}>`,
        isList: true,
        nullable: false,
        targetClass: targetClassName
      };

    case 'INHERITANCE':
      // En Flutter, la herencia se maneja con 'extends'
      // No generamos campo adicional
      return null;

    case 'COMPOSITION':
    case 'AGGREGATION':
      // Similar a ONE_TO_MANY pero con semántica diferente
      return {
        fieldName: fieldName.endsWith('s') ? fieldName : `${fieldName}s`,
        dartType: `List<${targetClassName}>`,
        isList: true,
        nullable: false,
        targetClass: targetClassName
      };

    default:
      return null;
  }
}

/**
 * Encuentra todas las relaciones donde la clase es origen
 * 
 * @param className - Nombre de la clase
 * @param classId - ID de la clase en el diagrama
 * @param relations - Array de relaciones del diagrama
 * @returns Array de relaciones procesadas
 */
export function getRelationsForClass(
  className: string,
  classId: string,
  relations: any[],
  classesMap: Map<string, string> // Map<classId, className>
): ProcessedRelation[] {
  const processed: ProcessedRelation[] = [];

  for (const rel of relations) {
    if (rel.source === classId) {
      const targetClassName = classesMap.get(rel.target);
      if (!targetClassName) continue;

      const processedRel = processRelation(rel, className, targetClassName);
      if (processedRel) {
        processed.push(processedRel);
      }
    }
  }

  return processed;
}