import * as fs from 'fs';
import * as path from 'path';

// Helpers localizados para no depender de exports del generador principal
function toJavaClassName(name: string): string {
  if (!name) return 'GeneratedClass';
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'GeneratedClass';
  const pascal = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  if (!/^[A-Za-z]/.test(pascal)) return `C${pascal}`;
  return pascal;
}

function toSafeName(name: string): string {
  return toJavaClassName(name).toLowerCase();
}

function isIdLikeAttribute(attr: any): boolean {
  const name = (attr?.name || '').trim();
  if (!name) return false;
  if (attr?.isId) return true;
  const lower = name.toLowerCase();
  if (lower === 'id') return true;
  return /^id([A-Z_0-9].*)?$/.test(name);
}

/**
 * Mapea tipos del UML a tipos Java (mismo mapeo que springBootGenerator).
 * - type: cadena con el tipo UML.
 * - Retorna: tipo Java como string.
 */
function mapTypeToJava(type: string): string {
  const normalizedType = type?.trim() || '';
  
  const typeMap: { [key: string]: string } = {
    'String': 'String',
    'Long': 'Long',
    'Integer': 'Integer',
    'Boolean': 'Boolean',
    'LocalDateTime': 'LocalDateTime',
    'BigDecimal': 'BigDecimal',
    'Double': 'Double',
    'Float': 'Float',
    'LocalDate': 'LocalDate',
    'Date': 'LocalDate',
    'Time': 'LocalTime',
    'LocalTime': 'LocalTime',
    'Text': 'String',
    'Varchar': 'String',
    'Number': 'Long',
    'Int': 'Integer',
    'Bool': 'Boolean',
    'DateTime': 'LocalDateTime',
    'Timestamp': 'LocalDateTime',
    'Decimal': 'BigDecimal',
    'Money': 'BigDecimal',
    'Email': 'String',
    'URL': 'String',
    'UUID': 'String'
  };

  // Check for exact match first
  if (typeMap[normalizedType]) {
    return typeMap[normalizedType];
  }

  // Check for case-insensitive match
  const lowerType = normalizedType.toLowerCase();
  for (const [key, value] of Object.entries(typeMap)) {
    if (key.toLowerCase() === lowerType) {
      return value;
    }
  }

  // Default to String
  return 'String';
}

/**
 * Genera un JSON de ejemplo para una clase, excluyendo IDs y campos generados automáticamente.
 * Incluye atributos heredados de la clase padre si hay herencia.
 * - cls: definición de clase UML.
 * - includeId: si incluir campos ID (por defecto false para POST/PUT).
 * - classMap: mapa de clases por nombre para buscar clases padre.
 * - Retorna: string JSON formateado.
 */
function generateSampleJson(cls: any, includeId: boolean = false, classMap: Map<string, any> = new Map()): string {
  const sample: any = {};
  
  // Recopilar todos los atributos incluyendo los heredados
  const allAttributes: any[] = [];
  
  // Detectar relación de herencia
  const inheritanceRels = (cls.relations || []).filter((r: any) => r.type === 'INHERITANCE');
  if (inheritanceRels.length > 0) {
    const parentClassName = inheritanceRels[0].target;
    const parentClass = classMap.get(parentClassName);
    
    if (parentClass) {
      // Agregar atributos de la clase padre primero (excluyendo ID si includeId es false)
      const parentAttrs = (parentClass.attributes || []).filter((a: any) => {
        if (!includeId && isIdLikeAttribute(a)) return false;
        return true;
      });
      allAttributes.push(...parentAttrs);
    }
  }
  
  // Agregar atributos de la clase actual
  const currentAttrs = (cls.attributes || []).filter((a: any) => {
    if (!includeId && isIdLikeAttribute(a)) return false;
    return true;
  });
  allAttributes.push(...currentAttrs);

  for (const attr of allAttributes) {
    // Excluir campos generados automáticamente (createdAt, updatedAt)
    const attrNameLower = attr.name.toLowerCase();
    if (attrNameLower === 'createdat' || attrNameLower === 'updatedat' || 
        attrNameLower === 'created_at' || attrNameLower === 'updated_at') {
      continue;
    }

    const javaType = mapTypeToJava(attr.type);
    
    // Generar valores de ejemplo según el tipo Java
    switch (javaType) {
      case 'Long':
      case 'Integer':
        sample[attr.name] = 1;
        break;
      case 'Double':
      case 'Float':
      case 'BigDecimal':
        sample[attr.name] = 99.99;
        break;
      case 'Boolean':
        sample[attr.name] = true;
        break;
      case 'LocalDate':
        sample[attr.name] = '2025-11-10';
        break;
      case 'LocalDateTime':
        sample[attr.name] = '2025-11-10T12:00:00';
        break;
      case 'LocalTime':
        sample[attr.name] = '12:00:00';
        break;
      case 'String':
      default:
        // Generar valores más descriptivos según el nombre del atributo
        const nameLower = attr.name.toLowerCase();
        if (nameLower.includes('email')) {
          sample[attr.name] = 'example@email.com';
        } else if (nameLower.includes('url') || nameLower.includes('link')) {
          sample[attr.name] = 'https://example.com';
        } else if (nameLower.includes('phone') || nameLower.includes('telefono')) {
          sample[attr.name] = '+1234567890';
        } else if (nameLower.includes('name') || nameLower.includes('nombre')) {
          sample[attr.name] = `Sample ${cls.name}`;
        } else if (nameLower.includes('description') || nameLower.includes('descripcion')) {
          sample[attr.name] = `Sample description for ${attr.name}`;
        } else {
          sample[attr.name] = `Sample ${attr.name}`;
        }
        break;
    }
  }

  return JSON.stringify(sample, null, 2);
}

export async function generatePostmanCollection(projectDir: string, projectName: string, classes: any[]): Promise<void> {
  // Base fija solicitada por el usuario
  const defaultBase = 'http://localhost:8080';

  const collection: any = {
    info: {
      name: `${projectName} API`,
      description: `Generated API collection for ${projectName}`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    // Variable de colección para reconfigurar fácilmente
    variable: [
      { key: 'baseUrl', value: defaultBase }
    ],
    item: []
  };

  // Crear un mapa de clases por nombre para buscar clases padre
  const classMap = new Map<string, any>();
  classes.forEach(cls => {
    classMap.set(cls.name, cls);
  });

  for (const cls of classes) {
    const className = toSafeName(toJavaClassName(cls.name));

    const folder = {
      name: cls.name,
      item: [
        {
          name: `Create ${cls.name}`,
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: generateSampleJson(cls, false, classMap)
            },
            url: {
              raw: `${defaultBase}/api/${className}s`,
              path: ['api', `${className}s`]
            }
          }
        },
        {
          name: `Get All ${cls.name}s`,
          request: {
            method: 'GET',
            url: {
              raw: `${defaultBase}/api/${className}s`,
              path: ['api', `${className}s`]
            }
          }
        },
        {
          name: `Get ${cls.name} by ID`,
          request: {
            method: 'GET',
            url: {
              raw: `${defaultBase}/api/${className}s/1`,
              path: ['api', `${className}s`, '1']
            }
          }
        },
        {
          name: `Update ${cls.name}`,
          request: {
            method: 'PUT',
            header: [
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: generateSampleJson(cls, true, classMap) // Incluir ID para actualización
            },
            url: {
              raw: `${defaultBase}/api/${className}s/1`,
              path: ['api', `${className}s`, '1']
            }
          }
        },
        {
          name: `Delete ${cls.name}`,
          request: {
            method: 'DELETE',
            url: {
              raw: `${defaultBase}/api/${className}s/1`,
              path: ['api', `${className}s`, '1']
            }
          }
        }
      ]
    };

    collection.item.push(folder as any);
  }

  // Carpeta utilitaria con healthcheck usando base por defecto y variable
  collection.item.push({
    name: 'Utilities',
    item: [
      {
        name: 'Health (fixed url)',
        request: {
          method: 'GET',
          url: { raw: `${defaultBase}/health` }
        }
      },
      {
        name: 'Health (variable baseUrl)',
        request: {
          method: 'GET',
          url: { raw: `{{baseUrl}}/health`, path: ['health'] }
        }
      }
    ]
  });

  await fs.promises.writeFile(
    path.join(projectDir, 'docs', `${projectName}-postman-collection.json`),
    JSON.stringify(collection, null, 2)
  );
}
