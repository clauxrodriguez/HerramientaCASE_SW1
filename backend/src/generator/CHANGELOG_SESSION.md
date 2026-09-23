# Changelog: Correcciones y Mejoras en Generadores

**Fecha:** 2025-11-10  
**Sesión:** Corrección de bugs y mejoras en generadores Spring Boot, Flutter y Postman

---

## Resumen Ejecutivo

Esta sesión se enfocó en corregir múltiples problemas críticos en los generadores de código:

1. **Serialización de diagramas UML**: Corrección de inconsistencia entre frontend y backend al enviar relaciones
2. **Generador Spring Boot**: Correcciones en herencia, DTOs, relaciones ONE_TO_MANY y manejo de campos ID
3. **Generador Postman**: Inclusión de campos heredados y mejor mapeo de tipos
4. **Generador Flutter**: Correcciones en rutas, acceso a campos ID, validaciones y estructura de ZIP
5. **Manejo de errores**: Mejoras en el manejo de casos edge (clases sin atributos, Flutter CLI no disponible)

---

## 1. Corrección de Serialización de Diagramas UML

### Problema Identificado

El frontend enviaba las relaciones del diagrama con **IDs de clases** en lugar de **nombres de clases**, mientras que el backend esperaba nombres.

**Evidencia:**
- `serializeDiagram` convertía IDs a nombres correctamente (líneas 103-104)
- `useBackendGenerator.ts` enviaba IDs directamente (líneas 39-40, 111-112)
- El backend esperaba nombres (springBootGenerator.ts línea 542-543)

### Solución Implementada

**Archivo modificado:** `frontend/src/components/Sidebar/hooks/useBackendGenerator.ts`

Se modificaron las funciones `handleGenerateBackend`, `handleGenerateFlutter` y `handleAISuggest` para convertir IDs a nombres de clases antes de enviar al backend:

```typescript
// Antes:
relations: diagram.relations.map((rel: any) => ({
  source: rel.source, // ❌ ID (ej: 'c1')
  target: rel.target, // ❌ ID (ej: 'c2')
  ...
}))

// Después:
relations: diagram.relations.map((rel: any) => {
  const sourceClass = diagram.classes.find((c: any) => c.id === rel.source);
  const targetClass = diagram.classes.find((c: any) => c.id === rel.target);
  return {
    source: sourceClass?.name || rel.source, // ✅ Nombre (ej: 'User')
    target: targetClass?.name || rel.target, // ✅ Nombre (ej: 'Post')
    ...
  };
})
```

**Archivo modificado:** `frontend/src/components/Sidebar/hooks/diagramSerializer.ts`

Se actualizó el test para reflejar el comportamiento correcto (esperar nombres en lugar de IDs).

### Resultado

- Las relaciones ahora usan nombres de clases consistentemente
- Compatible con lo que espera el backend
- El JSON generado es correcto para generación de código Spring Boot y Flutter

---

## 2. Correcciones en Generador Spring Boot

### 2.1. Problema: Herencia y @SuperBuilder

**Error de compilación:**
```
java: builder() in com.example.entity.CLIENTE cannot hide builder() in com.example.entity.PERSONA
```

**Causa:** Las clases con herencia usaban `@Builder` de Lombok, que no es compatible con herencia.

**Solución:**

**Archivo modificado:** `server/src/generator/springBootGenerator.ts`

1. Se agregó lógica para detectar si una clase es padre o hija en una relación de herencia
2. Se usa `@SuperBuilder` en lugar de `@Builder` para clases con herencia
3. Se agregó el import necesario: `import lombok.experimental.SuperBuilder;`

```typescript
// En generateEntityClass:
const useSuperBuilder = isParent || isChild;
const builderAnnotation = useSuperBuilder 
  ? '@SuperBuilder' 
  : '@Builder';
```

### 2.2. Problema: ID Duplicado en Clases Hijas

**Error de compilación:**
```
Column 'id' is duplicated in mapping for entity 'com.example.entity.CLIENTE'
```

**Causa:** Las clases hijas generaban el campo `@Id` aunque ya lo heredaban de la clase padre.

**Solución:**

**Archivo modificado:** `server/src/generator/springBootGenerator.ts`

Se modificó `generateEntityClass` para omitir completamente los atributos identificados como ID en clases hijas (clases con `parentClass`):

```typescript
// Omitir atributos ID en clases hijas
if (cls.parentClass && attr.isId) {
  continue; // No generar el campo ID, se hereda
}
```

### 2.3. Problema: Relaciones ONE_TO_MANY sin mappedBy

**Problema:** Se generaban múltiples tablas intermedias innecesarias (ej: `producto_productoventadetalle`, `productoventadetalle_producto`, `productoventadetalle_venta`) para relaciones `ONE_TO_MANY`.

**Causa:** Las relaciones `ONE_TO_MANY` no tenían `mappedBy` y Hibernate las trataba como `MANY_TO_MANY`, creando tablas intermedias.

**Solución:**

**Archivo modificado:** `server/src/generator/springBootGenerator.ts`

1. **Nueva función `mapRelationsToClasses`**: Preprocesa las relaciones y agrega automáticamente la relación inversa `MANY_TO_ONE` en el lado "many" cuando falta `mappedBy`:

```typescript
function mapRelationsToClasses(classes: any[], relations: any[]): any[] {
  // ... código de mapeo ...
  
  // Para relaciones ONE_TO_MANY sin mappedBy, agregar la relación inversa MANY_TO_ONE
  if (rel.type === 'ONE_TO_MANY' && !rel.mappedBy) {
    // Agregar MANY_TO_ONE en targetClass
    targetClass.relations.push({
      type: 'MANY_TO_ONE',
      source: targetClassName,
      target: sourceClassName,
      // ...
    });
    
    // Agregar mappedBy a la relación original
    rel.mappedBy = manyToOneFieldName;
  }
}
```

2. **Corrección en `generateRelationshipAnnotation`**: Ajuste de lógica para interpretar correctamente cardinalidades como `1..*` y generar `@JoinColumn` apropiado.

3. **Conversión de nombres**: Mejora en la conversión de nombres de clases en mayúsculas (ej: `PRODUCTO` → `producto` para `mappedBy`).

### 2.4. Problema: DTOs sin Campos Heredados

**Problema:** Los DTOs (`RequestDTO` y `ResponseDTO`) no incluían los campos heredados de la clase padre.

**Ejemplo:** `CLIENTERequest` no incluía `Nombre` y `Telefono` de `PERSONA`.

**Solución:**

**Archivo modificado:** `server/src/generator/springBootGenerator.ts`

Se modificaron `generateRequestDTO` y `generateResponseDTO` para:

1. Recopilar atributos de la clase padre (excluyendo IDs)
2. Recopilar atributos de la clase actual
3. Usar un `Set` para evitar duplicados
4. Agregar `@JsonProperty` para mapeo correcto de nombres no camelCase

```typescript
// Recopilar atributos de clase padre
const parentAttrs: any[] = [];
if (cls.parentClass) {
  const parentClass = classes.find(c => c.name === cls.parentClass);
  if (parentClass) {
    parentAttrs.push(...(parentClass.attributes || []).filter(a => !a.isId));
  }
}

// Combinar y deduplicar
const allAttrs = [...parentAttrs, ...(cls.attributes || [])];
const seenAttributeNames = new Set<string>();
// ... agregar atributos evitando duplicados ...
```

### 2.5. Problema: Campos Null en DTOs por Nombres Incorrectos

**Problema:** Los campos llegaban como `null` cuando el JSON tenía los nombres correctos (ej: `Nombre`, `Fecha`) pero los DTOs esperaban camelCase.

**Solución:**

Se agregó `@JsonProperty` a todos los campos de los DTOs:

```java
@JsonProperty("Nombre")
private String Nombre;

@JsonProperty("Fecha")
private String Fecha;
```

**Archivo modificado:** `server/src/generator/springBootGenerator.ts`

Se agregó el import y la anotación en `generateRequestDTO` y `generateResponseDTO`:

```typescript
imports.add('import com.fasterxml.jackson.annotation.JsonProperty;');
// ...
fields.push(`  @JsonProperty("${attr.name}")`);
fields.push(`  private ${javaType} ${attr.name};`);
```

### 2.6. Simplificación de application.properties

**Archivo modificado:** `server/src/generator/springBootGenerator.ts`

Se simplificó la configuración de Hibernate eliminando propiedades redundantes.

---

## 3. Correcciones en Generador Postman

### 3.1. Problema: Campos Heredados Faltantes en JSON de Ejemplo

**Problema:** Los JSON de ejemplo en la colección Postman no incluían campos heredados.

**Solución:**

**Archivo modificado:** `server/src/generator/postmanGenerator.ts`

1. **Nueva función `mapTypeToJava`**: Implementada para consistencia con Spring Boot
2. **Modificación de `generateSampleJson`**:
   - Ahora acepta `classMap` como parámetro
   - Recopila atributos de clases padre iterando recursivamente
   - Excluye `id` para POST y `createdAt`/`updatedAt` para todos los requests
   - Genera valores de ejemplo más descriptivos basados en nombres de atributos

```typescript
function generateSampleJson(
  cls: any,
  classMap: Map<string, any>,
  includeId: boolean = false
): any {
  const sample: any = {};
  const allAttrs: any[] = [];
  
  // Recopilar atributos de clase padre
  if (cls.parentClass) {
    const parent = classMap.get(cls.parentClass);
    if (parent) {
      allAttrs.push(...collectParentAttributes(parent, classMap));
    }
  }
  
  // Agregar atributos de clase actual
  allAttrs.push(...(cls.attributes || []));
  
  // Generar valores de ejemplo
  // ...
}
```

### Resultado

- Los JSON de ejemplo ahora incluyen todos los campos necesarios
- Compatible con los DTOs generados por Spring Boot
- Valores de ejemplo más realistas y descriptivos

---

## 4. Correcciones en Generador Flutter

### 4.1. Problema: Rutas Generadas para Clases sin Atributos

**Error:**
```
Error when reading 'lib/pages/producto_venta_detalle/producto_venta_detalle_list_page.dart': 
El sistema no puede encontrar el archivo especificado.
```

**Causa:** El generador de rutas creaba rutas para todas las clases, incluso las que no tenían atributos (y por lo tanto no tenían páginas generadas).

**Solución:**

**Archivo modificado:** `server/src/generator_flutter/projectBuilder.ts`

Se filtraron las clases que tienen atributos antes de generar rutas, sidebar y home page:

```typescript
// Filtrar clases que tienen atributos (solo estas tienen páginas generadas)
const classesWithAttributes = classes.filter(cls => {
  const attrs = ((cls as any).attributes || []) as UMLAttribute[];
  return attrs && attrs.length > 0;
});

const classNames = classesWithAttributes.map(c => c.name);
```

### 4.2. Problema: Acceso Incorrecto a Campo ID

**Error:**
```
The getter 'id' isn't defined for the type 'FACTURA'.
```

**Causa:** El código generado usaba `widget.item!.id` hardcodeado, pero algunas clases tienen IDs con nombres diferentes (ej: `id_factura` en lugar de `id`).

**Solución:**

**Archivo modificado:** `server/src/generator_flutter/generators/pages/formPageGenerator.ts`

Se calcula el nombre del campo ID antes de generar el template string:

```typescript
// Encontrar el atributo ID para usar su nombre correcto
const idAttr = attributes.find(a => a.isId) || attributes[0];
const idFieldName = idAttr?.name || 'id';

// Luego en el template:
await _service.update(widget.item!.${idFieldName}, item);
```

### 4.3. Problema: Validaciones Faltantes en Generadores de Páginas

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'name')
```

**Causa:** Los generadores no validaban que las clases tuvieran atributos antes de intentar acceder a ellos.

**Solución:**

**Archivos modificados:**
- `server/src/generator_flutter/generators/pages/listPageGenerator.ts`
- `server/src/generator_flutter/generators/pages/formPageGenerator.ts`
- `server/src/generator_flutter/projectBuilder.ts`

Se agregaron validaciones explícitas:

```typescript
// En listPageGenerator.ts:
if (!attributes || attributes.length === 0) {
  throw new Error(`La clase ${className} no tiene atributos definidos...`);
}

const idAttr = attributes.find(a => a.isId) || attributes[0];
if (!idAttr) {
  throw new Error(`La clase ${className} no tiene atributos válidos.`);
}

// En formPageGenerator.ts:
const editableAttrs = attributes.filter(a => !a.isId);
if (editableAttrs.length === 0) {
  throw new Error(`La clase ${className} no tiene atributos editables...`);
}

// En projectBuilder.ts:
if (!attrs || attrs.length === 0) {
  console.warn(`⚠️  La clase ${cls.name} no tiene atributos. Se omitirá la generación de páginas para esta clase.`);
  return;
}
```

### 4.4. Problema: ZIP sin Carpeta Raíz

**Problema:** Los archivos del proyecto se extraían directamente en el directorio actual, sin una carpeta raíz con el nombre del proyecto.

**Solución:**

**Archivo modificado:** `server/src/generator_flutter/platformAndPackaging.ts`

Se modificó `zipDirectory` para aceptar un parámetro opcional `projectName`:

```typescript
export async function zipDirectory(
  sourceDir: string,
  outputPath: string,
  projectName?: string
): Promise<void> {
  // ...
  const rootFolderName = projectName || path.basename(sourceDir);
  archive.directory(sourceDir, rootFolderName);
  // ...
}
```

**Archivo modificado:** `server/src/generator_flutter/orchestrator.ts`

Se determinó y normalizó el nombre del proyecto antes de crear el ZIP:

```typescript
const projectName = diagram.name || diagram.package || 'flutter-app';
const normalizedProjectName = projectName
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '') || 'flutter-app';

await zipDirectory(projectDir, zipPath, normalizedProjectName);
```

**Nota:** El generador Spring Boot ya tenía esta funcionalidad implementada correctamente.

### 4.5. Problema: Flutter CLI No Disponible Causaba Error Fatal

**Error:**
```
[flutter] "flutter" no se reconoce como un comando interno o externo...
[Flutter Generator] ❌ Error: Error: flutter commands exited with code 1
```

**Causa:** El generador intentaba ejecutar comandos de Flutter CLI sin verificar si estaba disponible, causando que el proceso completo fallara.

**Solución:**

**Archivo modificado:** `server/src/generator_flutter/enablePlatforms.ts`

1. **Nueva función `isFlutterAvailable()`**: Verifica si Flutter está instalado antes de intentar ejecutar comandos

2. **Manejo de errores mejorado**: Si Flutter no está disponible, se emiten advertencias pero el proceso continúa:

```typescript
export function enableFlutterPlatforms(...): Promise<void> {
  // Verificar si Flutter está disponible
  if (!isFlutterAvailable()) {
    console.warn('[Flutter Generator] ⚠️  Flutter CLI no está disponible en el sistema.');
    console.warn('[Flutter Generator] ⚠️  Se omitirá la habilitación de plataformas.');
    console.warn('[Flutter Generator] ℹ️  El proyecto generado seguirá siendo funcional.');
    console.warn('[Flutter Generator] ℹ️  Para habilitar plataformas, ejecuta manualmente: flutter create .');
    return Promise.resolve(); // Continuar sin fallar
  }
  
  // ... resto del código ...
  
  proc.on('error', (err) => {
    // Si el error es porque Flutter no está disponible, solo advertir y continuar
    if (err.message && (err.message.includes('ENOENT') || err.message.includes('no se reconoce'))) {
      console.warn('[Flutter Generator] ⚠️  Flutter CLI no está disponible. Se omitirá la habilitación de plataformas.');
      resolve(); // Continuar sin fallar
    } else {
      reject(err);
    }
  });
  
  proc.on('close', (code) => {
    if (code === 0) {
      resolve();
    } else {
      // Advertir pero no fallar
      console.warn(`[Flutter Generator] ⚠️  Comandos de Flutter terminaron con código ${code}.`);
      console.warn('[Flutter Generator] ℹ️  El proyecto se generará sin habilitar plataformas automáticamente.');
      resolve(); // Continuar sin fallar
    }
  });
}
```

### Resultado

- El generador funciona aunque Flutter no esté instalado
- Se generan todos los archivos del proyecto (modelos, servicios, páginas, etc.)
- Se crea el ZIP con la carpeta raíz correcta
- Se muestran advertencias informativas en lugar de errores fatales

---

## 5. Tests Agregados

### 5.1. Test de Relaciones ONE_TO_MANY con Entidades Intermedias

**Archivo creado:** `server/src/generator/__tests__/intermediateEntityRelations.test.ts`

Este test verifica que:
- Las relaciones `ONE_TO_MANY` generan `@OneToMany(mappedBy = "...")` correctamente
- Se crea la relación inversa `@ManyToOne` con `@JoinColumn` en la entidad intermedia
- **No** se crean tablas intermedias innecesarias (`@JoinTable` no está presente)

**Estructura del test:**
- Define un diagrama con `PRODUCTO`, `VENTA`, y `PRODUCTO_VENTA_DETALLE`
- Verifica que `PRODUCTO` y `VENTA` tienen `@OneToMany(mappedBy = "...")`
- Verifica que `PRODUCTO_VENTA_DETALLE` tiene `@ManyToOne` con `@JoinColumn`
- Verifica que **no** hay `@JoinTable` en ninguna de las entidades

---

## 6. Archivos Modificados - Resumen

### Frontend
- `frontend/src/components/Sidebar/hooks/useBackendGenerator.ts`
- `frontend/src/components/Sidebar/hooks/diagramSerializer.ts` (test)

### Backend - Generador Spring Boot
- `server/src/generator/springBootGenerator.ts`
- `server/src/types/uml.ts`

### Backend - Generador Postman
- `server/src/generator/postmanGenerator.ts`

### Backend - Generador Flutter
- `server/src/generator_flutter/generators/pages/listPageGenerator.ts`
- `server/src/generator_flutter/generators/pages/formPageGenerator.ts`
- `server/src/generator_flutter/projectBuilder.ts`
- `server/src/generator_flutter/platformAndPackaging.ts`
- `server/src/generator_flutter/orchestrator.ts`
- `server/src/generator_flutter/enablePlatforms.ts`

### Tests
- `server/src/generator/__tests__/intermediateEntityRelations.test.ts` (nuevo)

---

## 7. Mejoras de Calidad de Código

### 7.1. Validaciones y Manejo de Errores
- Validaciones explícitas en generadores de páginas Flutter
- Manejo graceful de Flutter CLI no disponible
- Validación de clases sin atributos

### 7.2. Consistencia
- Uso consistente de `mapTypeToJava` en Postman y Spring Boot
- Mapeo correcto de nombres de clases a nombres de campos (camelCase)
- Consistencia en el manejo de campos heredados

### 7.3. Documentación
- Comentarios mejorados en código
- Mensajes de error más descriptivos
- Advertencias informativas para el usuario

---

## 8. Problemas Resueltos - Checklist

- [x] Relaciones enviadas con IDs en lugar de nombres
- [x] Error de compilación: `builder() cannot hide builder()`
- [x] Error de compilación: `Column 'id' is duplicated`
- [x] Múltiples tablas intermedias innecesarias para ONE_TO_MANY
- [x] DTOs sin campos heredados
- [x] Campos null en DTOs por nombres incorrectos
- [x] Postman JSON sin campos heredados
- [x] Rutas Flutter para clases sin atributos
- [x] Acceso incorrecto a campo ID en formularios Flutter
- [x] Errores por falta de validaciones en generadores
- [x] ZIP sin carpeta raíz en Flutter
- [x] Error fatal cuando Flutter CLI no está disponible

---

## 9. Próximos Pasos Sugeridos

### Corto Plazo
1. Agregar más tests para casos edge (clases sin relaciones, herencia múltiple, etc.)
2. Mejorar la pluralización de nombres (usar librería `pluralize`)
3. Agregar validación de tipos en la entrada de los generadores

### Medio Plazo
1. Implementar streaming para ZIPs grandes (evitar OOM)
2. Agregar soporte para migraciones de base de datos (Flyway/Liquibase)
3. Mejorar el manejo de relaciones complejas (bidireccionales, múltiples niveles)

### Largo Plazo
1. Refactorizar templates a un motor de plantillas (Handlebars/EJS)
2. Agregar generación de tests unitarios
3. Implementar validación de esquema UML antes de generar código

---

## 10. Notas Técnicas

### Convenciones de Nombres
- **Clases Java**: PascalCase (ej: `Producto`, `Cliente`)
- **Campos Java**: camelCase (ej: `nombre`, `precioUnitario`)
- **Rutas API**: lowercase con guiones (ej: `/productos`, `/clientes`)
- **Clases Dart**: PascalCase (ej: `Producto`, `Cliente`)
- **Archivos Dart**: snake_case (ej: `producto_list_page.dart`)

### Tipos de Relaciones Soportadas
- `ONE_TO_ONE`: `@OneToOne` + `@JoinColumn`
- `ONE_TO_MANY`: `@OneToMany` + `mappedBy` + `@ManyToOne` inverso
- `MANY_TO_ONE`: `@ManyToOne` + `@JoinColumn`
- `MANY_TO_MANY`: `@ManyToMany` + `@JoinTable`
- `INHERITANCE`: `@Inheritance(strategy = JOINED)` + `extends`
- `COMPOSITION`: `@OneToMany` + `orphanRemoval = true`
- `AGGREGATION`: `@OneToMany` + `CascadeType.PERSIST`

### Estrategias de Generación
- **Spring Boot**: Usa Hibernate DDL auto-update (no genera scripts SQL explícitos)
- **Flutter**: Genera código Dart con servicios HTTP para comunicación con API
- **Postman**: Genera colección JSON con ejemplos de requests

---

## 11. Referencias

- [Documentación Spring Boot JPA](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/)
- [Documentación Hibernate](https://hibernate.org/orm/documentation/)
- [Documentación Flutter](https://docs.flutter.dev/)
- [Documentación Postman Collections](https://learning.postman.com/docs/getting-started/creating-the-first-collection/)

---

**Fin del documento**

