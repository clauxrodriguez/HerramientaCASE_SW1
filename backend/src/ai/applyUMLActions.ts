/**
 * applyUMLActions.ts
 *
 * Helper to apply a list of UMLAction objects over a UML diagram.
 * This module keeps a defensive implementation (uses `any`) to avoid
 * circular type imports and to be robust during early integration.
 *
 * The function returns a new diagram object (does not mutate the original).
 */

/**
 * Generate a simple unique id for relations
 */
function genId(prefix = 'rel'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Infiere el tipo de dato de un atributo basándose en su nombre
 */
export function inferAttributeType(attributeName: string): string {
  if (!attributeName) return 'String';
  
  const name = attributeName.toLowerCase();
  
  // IDs
  if (name === 'id' || name.endsWith('id')) {
    return 'Long';
  }
  
  // Booleanos
  if (name.startsWith('is') || name.startsWith('has') || name.startsWith('can') || 
      name === 'activo' || name === 'habilitado' || name === 'visible' || 
      name === 'eliminado' || name === 'enabled' || name === 'disabled') {
    return 'Boolean';
  }
  
  // Fechas
  if (name.includes('fecha') || name.includes('date') || name.includes('time') ||
      name.includes('created') || name.includes('updated') || name.includes('deleted')) {
    return 'LocalDateTime';
  }
  
  // Números enteros
  if (name.includes('edad') || name.includes('age') || name.includes('año') || 
      name.includes('year') || name.includes('cantidad') || name.includes('quantity') ||
      name.includes('stock') || name.includes('numero') || name.includes('number')) {
    return 'Long';
  }
  
  // Números decimales
  if (name.includes('precio') || name.includes('price') || name.includes('costo') ||
      name.includes('cost') || name.includes('total') || name.includes('monto') ||
      name.includes('amount') || name.includes('saldo') || name.includes('balance') ||
      name.includes('descuento') || name.includes('discount') || name.includes('impuesto') ||
      name.includes('tax') || name.includes('porcentaje') || name.includes('percentage')) {
    return 'BigDecimal';
  }
  
  // Por defecto, String
  return 'String';
}

/**
 * Obtiene la cardinalidad por defecto según el tipo de relación y la posición (source/target)
 */
function getDefaultCardinality(relationType: string, position: 'source' | 'target'): string {
  switch (relationType) {
    case 'ONE_TO_ONE':
      return '1';
    case 'ONE_TO_MANY':
      return position === 'source' ? '1' : '*';
    case 'MANY_TO_ONE':
      return position === 'source' ? '*' : '1';
    case 'MANY_TO_MANY':
      return '*';
    case 'INHERITANCE':
      // Herencia: una clase padre puede tener muchas hijas, una hija tiene un padre
      return position === 'source' ? '1' : '*';
    case 'COMPOSITION':
      // Composición: el todo tiene muchas partes, la parte pertenece a un todo
      return position === 'source' ? '1' : '*';
    case 'AGGREGATION':
      // Agregación: similar a composición pero más débil
      return position === 'source' ? '1' : '*';
    default:
      return '*';
  }
}

/**
 * applyActionsToDiagram
 * ---------------------
 * Aplica una lista de acciones (propuestas por la AI) sobre una copia del
 * diagrama actual. Soporta un subconjunto de acciones habituales:
 *  - ADD_ATTRIBUTE, UPDATE_ATTRIBUTE, DELETE_ATTRIBUTE
 *  - CREATE_RELATION, UPDATE_RELATION, DELETE_RELATION
 *  - CREATE_CLASS, DELETE_CLASS, RENAME_CLASS
 *
 * Parámetros:
 *  - currentDiagram: objeto del diagrama actual (se clona internamente)
 *  - actions: array de acciones con estructura flexible (any)
 *
 * Retorna: diagrama nuevo con las modificaciones aplicadas.
 */
export function applyActionsToDiagram(currentDiagram: any, actions: any[]): any {
  // defensivo: asegurar estructura mínima
  const diagram = JSON.parse(JSON.stringify(currentDiagram || { classes: [], relations: [] }));
  diagram.classes = Array.isArray(diagram.classes) ? diagram.classes : [];
  diagram.relations = Array.isArray(diagram.relations) ? diagram.relations : [];
  const warnings: string[] = [];

  if (!Array.isArray(actions) || actions.length === 0) return diagram;

  for (const action of actions) {
    const type = (action && action.type) || '';
    const target = (action && action.target) || {};
    const payload = action.payload;

    // Helper: resolver referencia de clase por id o por name (case-insensitive)
    const resolveClassRef = (ref: any): string | null => {
      if (!ref) return null;
      const targetStr = (typeof ref === 'string' ? ref : (ref.name ?? ref)).toString().toLowerCase().trim();
      
      // buscar por id
      const byId = diagram.classes.find((c: any) => c.id && c.id.toString().toLowerCase() === targetStr);
      if (byId) return byId.id;
      
      // buscar por name
      const byName = diagram.classes.find((c: any) => c.name && c.name.toString().toLowerCase() === targetStr);
      if (byName) return byName.id;
      return null;
    };

    switch (type) {
      case 'ADD_ATTRIBUTE': {
        const className = target.className;
        if (!className) break;
        const cls = diagram.classes.find((c: any) => c.name === className);
        if (!cls) break;
        cls.attributes = Array.isArray(cls.attributes) ? cls.attributes : [];
        
        // Si el payload no tiene tipo, inferirlo del nombre del atributo
        let attr = payload || { name: 'nuevo', type: 'String', nullable: false };
        if (!attr.type && attr.name) {
          attr = { ...attr, type: inferAttributeType(attr.name) };
        }
        
        // Si es un ID, marcar isId como true
        if (attr.name && (attr.name.toLowerCase() === 'id' || attr.name.toLowerCase().endsWith('id'))) {
          attr = { ...attr, isId: true, type: 'Long' };
        }
        
        if (!cls.attributes.some((a: any) => a.name === attr.name)) {
          cls.attributes.push(attr);
        }
        break;
      }

      case 'UPDATE_ATTRIBUTE': {
        const className = target.className;
        const attrName = target.attributeName || target.newAttributeName;
        if (!className || !attrName) break;
        const cls = diagram.classes.find((c: any) => c.name === className);
        if (!cls) break;
        cls.attributes = Array.isArray(cls.attributes) ? cls.attributes : [];
        
        // Buscar por nombre actual o nuevo nombre
        let idx = cls.attributes.findIndex((a: any) => a.name === attrName);
        if (idx === -1 && target.attributeName) {
          // Si no se encuentra, buscar por el nombre original
          idx = cls.attributes.findIndex((a: any) => a.name === target.attributeName);
        }
        
        if (idx !== -1 && payload) {
          // Si se cambia el nombre, actualizarlo
          const updatedAttr = { ...cls.attributes[idx], ...payload };
          if (payload.name && payload.name !== attrName) {
            updatedAttr.name = payload.name;
          }
          
          // Si no se especifica el tipo, inferirlo del nuevo nombre
          if (!updatedAttr.type && updatedAttr.name) {
            updatedAttr.type = inferAttributeType(updatedAttr.name);
          }
          
          // Si es un ID, marcar isId como true
          if (updatedAttr.name && (updatedAttr.name.toLowerCase() === 'id' || updatedAttr.name.toLowerCase().endsWith('id'))) {
            updatedAttr.isId = true;
            updatedAttr.type = 'Long';
          }
          
          cls.attributes[idx] = updatedAttr;
        }
        break;
      }

      case 'DELETE_ATTRIBUTE': {
        const className = target.className;
        const attrName = target.attributeName;
        if (!className || !attrName) break;
        const cls = diagram.classes.find((c: any) => c.name === className);
        if (!cls) break;
        cls.attributes = (cls.attributes || []).filter((a: any) => a.name !== attrName);
        break;
      }

      case 'CREATE_RELATION': {
        const rel = { ...(payload || {}) };
        diagram.relations = Array.isArray(diagram.relations) ? diagram.relations : [];

        // resolver referencias source/target por id o por name
        const sourceRef = rel.source || rel.sourceClassName || rel.sourceName;
        const targetRef = rel.target || rel.targetClassName || rel.targetName;
        const resolvedSource = resolveClassRef(sourceRef);
        const resolvedTarget = resolveClassRef(targetRef);

        if (!resolvedSource || !resolvedTarget) {
          warnings.push(`CREATE_RELATION skipped: missing class reference (source=${sourceRef} resolved=${resolvedSource}, target=${targetRef} resolved=${resolvedTarget})`);
          break;
        }

        // Validar que el tipo de relación sea válido
        const validTypes = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY', 'INHERITANCE', 'COMPOSITION', 'AGGREGATION'];
        if (!rel.type || !validTypes.includes(rel.type)) {
          warnings.push(`CREATE_RELATION skipped: invalid relation type '${rel.type}'. Valid types: ${validTypes.join(', ')}`);
          break;
        }

        // Construir relación completa con todos los campos requeridos
        const newRelation: any = {
          id: rel.id || genId('rel'),
          type: rel.type,
          source: resolvedSource,
          target: resolvedTarget,
          // Cardinalidades: usar valores por defecto si no se proporcionan
          sourceCardinality: rel.sourceCardinality || getDefaultCardinality(rel.type, 'source'),
          targetCardinality: rel.targetCardinality || getDefaultCardinality(rel.type, 'target'),
        };

        // Campos opcionales
        if (rel.mappedBy) newRelation.mappedBy = rel.mappedBy;
        if (rel.joinColumn) newRelation.joinColumn = rel.joinColumn;
        if (rel.label) newRelation.label = rel.label;

        // Verificar si ya existe una relación idéntica
        const exists = diagram.relations.some((r: any) => 
          r.source === newRelation.source && 
          r.target === newRelation.target && 
          r.type === newRelation.type
        );
        
        if (!exists) {
          diagram.relations.push(newRelation);
        }
        break;
      }

      case 'UPDATE_RELATION': {
        const relId = target.relationId;
        if (relId) {
          const rel = (diagram.relations || []).find((r: any) => r.id === relId);
          if (rel && payload) Object.assign(rel, payload);
        } else {
          // intentar resolver por source/target/type
          const sourceRef = target.source || target.sourceClassName || target.sourceName || (payload && payload.source);
          const targetRef = target.target || target.targetClassName || target.targetName || (payload && payload.target);
          const resolvedSource = resolveClassRef(sourceRef);
          const resolvedTarget = resolveClassRef(targetRef);
          if (!resolvedSource || !resolvedTarget) {
            warnings.push(`UPDATE_RELATION skipped: cannot resolve source/target (source=${sourceRef}, target=${targetRef})`);
            break;
          }
          const rel = (diagram.relations || []).find((r: any) => r.source === resolvedSource && r.target === resolvedTarget && r.type === (target.type || payload?.type));
          if (rel && payload) Object.assign(rel, payload);
        }
        break;
      }

      case 'DELETE_RELATION': {
        const relId = target.relationId;
        if (relId) {
          diagram.relations = (diagram.relations || []).filter((r: any) => r.id !== relId);
        } else {
          const sourceRef = target.source || target.sourceClassName || target.sourceName;
          const targetRef = target.target || target.targetClassName || target.targetName;
          const resolvedSource = resolveClassRef(sourceRef);
          const resolvedTarget = resolveClassRef(targetRef);
          if (!resolvedSource || !resolvedTarget) {
            warnings.push(`DELETE_RELATION skipped: cannot resolve source/target (source=${sourceRef}, target=${targetRef})`);
            break;
          }
          diagram.relations = (diagram.relations || []).filter((r: any) => !(r.source === resolvedSource && r.target === resolvedTarget && r.type === target.type));
        }
        break;
      }

      case 'RENAME_CLASS': {
        const from = target.className;
        const to = target.newClassName;
        if (!from || !to) break;
        const cls = diagram.classes.find((c: any) => c.name === from);
        if (!cls) break;
        cls.name = to;
        (diagram.relations || []).forEach((r: any) => {
          if (r.source === from) r.source = to;
          if (r.target === from) r.target = to;
        });
        break;
      }

      case 'CREATE_CLASS': {
        const newCls = payload || {};
        if (!newCls.name) break;
        diagram.classes = Array.isArray(diagram.classes) ? diagram.classes : [];
        if (!diagram.classes.some((c: any) => c.name === newCls.name)) diagram.classes.push(newCls);
        break;
      }

      case 'DELETE_CLASS': {
        const className = target.className;
        if (!className) break;
        diagram.classes = (diagram.classes || []).filter((c: any) => c.name !== className);
        diagram.relations = (diagram.relations || []).filter((r: any) => r.source !== className && r.target !== className);
        break;
      }

      default:
        // ignore unknown action types
        break;
    }
  }

  if (warnings.length > 0) {
    // agregar advertencias en una propiedad no intrusiva
    (diagram as any)._aiWarnings = warnings;
  }

  return diagram;
}

export default applyActionsToDiagram;
