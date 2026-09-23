# Análisis Profundo de la Arquitectura - server/src

## 📋 Índice
1. [Visión General](#visión-general)
2. [Estructura de Directorios](#estructura-de-directorios)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Módulos Principales](#módulos-principales)
5. [Patrones de Diseño](#patrones-de-diseño)
6. [Flujos de Datos](#flujos-de-datos)
7. [Interacciones entre Componentes](#interacciones-entre-componentes)
8. [Puntos Clave de Implementación](#puntos-clave-de-implementación)

---

## 🎯 Visión General

El directorio `server/src` contiene la lógica del backend de una aplicación web colaborativa para crear diagramas UML y generar código automáticamente. El sistema está construido con:

- **Framework**: Express.js 4 + TypeScript
- **Base de Datos**: PostgreSQL (con pg Pool)
- **Colaboración en Tiempo Real**: Socket.io 4
- **Generación de Código**: Spring Boot (Java) y Flutter (Dart)
- **IA**: OpenAI API y Google Gemini API

### Principios Arquitectónicos

1. **Separación de Responsabilidades**: Cada módulo tiene una responsabilidad única
2. **Modularidad**: Estructura basada en carpetas por funcionalidad
3. **Tipado Fuerte**: TypeScript para seguridad de tipos
4. **Manejo de Errores**: Middleware centralizado y try-catch defensivo
5. **Limpieza de Recursos**: Gestión automática de archivos temporales

---

## 📁 Estructura de Directorios

```
server/src/
├── index.ts                    # Punto de entrada principal
├── types/
│   └── uml.ts                  # Tipos TypeScript para UML
├── db/
│   └── connection.ts           # Configuración PostgreSQL
├── routes/
│   ├── index.ts                # Router principal
│   ├── generator.ts             # Rutas de generación (Spring/Flutter)
│   ├── ai.ts                   # Rutas de IA (OpenAI)
│   └── ai_image_geminis.ts     # Rutas de IA visual (Gemini)
├── collaboration/
│   └── socketHandlers.ts       # Handlers de Socket.io
├── generator/
│   ├── springBootGenerator.ts  # Generador Spring Boot
│   └── postmanGenerator.ts     # Generador de colecciones Postman
├── generator_flutter/
│   ├── flutterGenerator.ts     # Punto de entrada Flutter
│   ├── orchestrator.ts          # Orquestador de generación
│   ├── projectBuilder.ts       # Constructor de proyecto
│   ├── generators/             # Generadores específicos
│   ├── templates/              # Plantillas de código
│   └── utils/                  # Utilidades (mappers, etc.)
└── ai/
    ├── openaiService.ts        # Servicio OpenAI
    ├── applyUMLActions.ts      # Aplicador de acciones UML
    └── gemini/                 # Módulo Gemini (OCR/Vision)
        ├── orchestrator.ts     # Orquestador de procesamiento de imágenes
        ├── geminiClient.ts     # Cliente Gemini
        ├── ImageProcessor.ts   # Procesador de imágenes
        └── visionParser.ts     # Parser de visión
```

---

## 🏗️ Arquitectura del Sistema

### Capa de Entrada (index.ts)

**Responsabilidades:**
- Inicialización del servidor Express
- Configuración de middleware (CORS, Helmet, Morgan, JSON parser)
- Configuración de Socket.io
- Servicio de archivos estáticos (frontend compilado)
- Manejo de errores global
- Health check endpoint

**Flujo de Inicialización:**
```
1. Cargar variables de entorno (.env)
2. Crear servidor HTTP + Express
3. Configurar Socket.io con CORS
4. Aplicar middleware de seguridad
5. Configurar rutas REST
6. Configurar handlers de WebSocket
7. Inicializar base de datos PostgreSQL
8. Iniciar servidor en puerto 3001
```

**Características Clave:**
- Soporte para servir frontend compilado desde `/dist`
- Catch-all handler para SPA (Single Page Application)
- Graceful shutdown con SIGTERM/SIGINT
- Manejo de errores con logging estructurado

### Capa de Rutas (routes/)

**Patrón**: Router modular de Express

**Estructura:**
```
/api/generator/spring    → Genera proyecto Spring Boot
/api/generator/flutter   → Genera aplicación Flutter
/api/ai/suggest          → Obtiene sugerencias de IA
/api/ai/from-text        → Genera clase UML desde texto
/api/ai/generate-diagram → Genera diagrama completo desde texto
/api/ai/modify-diagram   → Modifica diagrama con lenguaje natural
/api/ai/image-to-diagram → Convierte imagen a diagrama UML
```

**Características:**
- Validación de entrada en cada endpoint
- Manejo de errores específico por ruta
- Respuestas consistentes (JSON)
- Logging de operaciones

---

## 🔧 Módulos Principales

### 1. Módulo de Base de Datos (db/)

**Archivo**: `connection.ts`

**Responsabilidades:**
- Inicialización del pool de conexiones PostgreSQL
- Creación automática de tablas si no existen
- Gestión del ciclo de vida de conexiones

**Tablas Creadas:**
- `users`: Usuarios del sistema
- `diagrams`: Diagramas UML guardados
- `diagram_collaborators`: Relación muchos-a-muchos (diagramas ↔ usuarios)
- `sessions`: Sesiones activas de colaboración
- `locks`: Bloqueos de elementos durante edición

**Patrón**: Singleton para el pool de conexiones

**Funciones Exportadas:**
```typescript
initializeDatabase(): Promise<void>  // Inicializa BD y crea tablas
getPool(): Pool                      // Obtiene pool (lanza error si no inicializado)
closeDatabase(): Promise<void>       // Cierra conexiones
```

### 2. Módulo de Colaboración (collaboration/)

**Archivo**: `socketHandlers.ts`

**Responsabilidades:**
- Gestión de conexiones WebSocket
- Sincronización de diagramas en tiempo real
- Sistema de locks para edición concurrente
- Tracking de usuarios activos por diagrama

**Namespace**: `/diagram`

**Eventos Socket.io:**

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `diagram:join` | Cliente → Servidor | Unirse a un diagrama |
| `diagram:update` | Bidireccional | Actualizar diagrama |
| `diagram:lock` | Cliente → Servidor | Bloquear elemento |
| `diagram:unlock` | Cliente → Servidor | Desbloquear elemento |
| `diagram:cursor-update` | Cliente → Servidor | Actualizar posición cursor |
| `diagram:leave` | Cliente → Servidor | Salir del diagrama |
| `diagram:user-joined` | Servidor → Cliente | Notificar usuario nuevo |
| `diagram:user-left` | Servidor → Cliente | Notificar usuario salido |
| `diagram:users` | Servidor → Cliente | Lista de usuarios activos |
| `diagram:locks` | Servidor → Cliente | Lista de locks activos |

**Estructura de Datos en Memoria:**
```typescript
interface DiagramRoom {
  users: Map<string, CollaborationUser>;  // socketId → User
  locks: Map<string, CollaborationLock>; // elementId → Lock
  diagramData?: any;                      // Estado actual del diagrama
}
```

**Características:**
- Rooms por diagramId para aislamiento
- Limpieza automática de rooms vacíos
- Liberación automática de locks al desconectar
- Broadcast selectivo (excluye al emisor cuando corresponde)

### 3. Módulo de Generación Spring Boot (generator/)

**Archivo Principal**: `springBootGenerator.ts`

**Flujo de Generación:**
```
1. Validar entrada (UMLDiagramJSON)
2. Crear estructura temporal de directorios
3. Generar pom.xml (Maven)
4. Generar application.properties
5. Generar entidades JPA (entity/)
6. Generar DTOs (dto/)
7. Generar repositorios (repository/)
8. Generar servicios (service/ + service/impl/)
9. Generar controladores REST (controller/)
10. Generar colección Postman
11. Empaquetar en ZIP
12. Limpiar directorios temporales
13. Retornar Buffer del ZIP
```

**Funciones Clave:**

| Función | Responsabilidad |
|---------|----------------|
| `generateSpringBootProject()` | Función principal de generación |
| `createProjectStructure()` | Crea estructura de directorios Maven |
| `generateMavenFiles()` | Genera pom.xml y Application.java |
| `generateEntities()` | Genera clases JPA con anotaciones |
| `generateDTOs()` | Genera DTOs para transferencia |
| `generateRepositories()` | Genera interfaces JpaRepository |
| `generateServices()` | Genera servicios con interfaces |
| `generateControllers()` | Genera controladores REST con CRUD |
| `createZipFile()` | Empaqueta proyecto en ZIP |
| `removeDirWithRetry()` | Limpieza con reintentos (Windows) |

**Transformaciones de Nombres:**
- `toJavaClassName()`: Convierte a PascalCase válido para Java
- `toSafeName()`: Convierte a lowercase para nombres de archivo
- `toLowerCamel()`: Convierte a camelCase para variables
- `simplePlural()`: Pluralización simple para endpoints REST

**Características Avanzadas:**
- Detección automática de atributos ID (por nombre o flag `isId`)
- Soporte para herencia (relaciones `INHERITANCE`)
- Generación automática de timestamps (createdAt/updatedAt)
- Mapeo de relaciones JPA (OneToMany, ManyToOne, ManyToMany)
- Validaciones con Jakarta Validation
- Uso de Lombok para reducir boilerplate

**Archivo Complementario**: `postmanGenerator.ts`

**Responsabilidades:**
- Genera colección Postman con todos los endpoints REST
- Incluye ejemplos de JSON para requests
- Configura variable `baseUrl` para fácil reconfiguración
- Crea requests para cada operación CRUD por clase

### 4. Módulo de Generación Flutter (generator_flutter/)

**Archivo Principal**: `flutterGenerator.ts` (facade)
**Orquestador**: `orchestrator.ts`

**Flujo de Generación:**
```
1. Validar diagrama UML
2. Crear directorio temporal (generated/<uuid>)
3. Mapear clases y relaciones
4. Crear estructura de proyecto Flutter
5. Generar modelos (lib/models/)
6. Generar servicios (lib/services/)
7. Generar páginas (lib/pages/)
8. Generar navegación (lib/navigation/)
9. Generar configuración (pubspec.yaml, main.dart, README)
10. Habilitar plataformas (web, windows)
11. Empaquetar en ZIP
12. Limpiar temporales
13. Retornar ruta del ZIP
```

**Estructura Generada:**
```
flutter_app/
├── lib/
│   ├── models/          # Modelos Dart (clases)
│   ├── services/        # Servicios HTTP
│   ├── pages/           # Páginas (list, form)
│   ├── widgets/         # Widgets reutilizables
│   ├── navigation/      # Configuración de rutas
│   └── main.dart        # Punto de entrada
├── pubspec.yaml         # Dependencias
└── README.md            # Documentación
```

**Generadores Específicos** (`generators/`):
- `modelGenerator.ts`: Genera clases Dart con fromJson/toJson
- `serviceGenerator.ts`: Genera servicios HTTP con Dio
- `pageGenerator.ts`: Genera páginas base
- `listPageGenerator.ts`: Genera páginas de lista
- `formPageGenerator.ts`: Genera páginas de formulario
- `routeGenerator.ts`: Genera configuración de rutas
- `sidebarGenerator.ts`: Genera sidebar de navegación
- `widgetGenerator.ts`: Genera widgets reutilizables

**Utilidades** (`utils/`):
- `typeMapper.ts`: Mapea tipos UML → Dart
- `relationMapper.ts`: Procesa relaciones entre clases

**Características:**
- Arquitectura en capas (Modelo → Servicio → Página)
- Consumo automático de APIs REST generadas
- UI adaptativa con Material Design
- Soporte multi-plataforma (web, windows)

### 5. Módulo de IA - OpenAI (ai/)

**Archivo Principal**: `openaiService.ts`

**Funciones Principales:**

| Función | Descripción |
|---------|-------------|
| `getAISuggestions()` | Analiza diagrama y sugiere mejoras |
| `generateFromText()` | Genera una clase UML desde texto |
| `generateDiagramFromText()` | Genera diagrama completo desde texto |
| `modifyDiagramFromText()` | Modifica diagrama existente con lenguaje natural |

**Prompts del Sistema:**
- `DIAGRAM_SYSTEM_PROMPT`: Para generación de diagramas completos
- `MODIFY_SYSTEM_PROMPT`: Para modificación de diagramas existentes

**Formato de Respuesta:**
- Todas las funciones retornan JSON estructurado
- Fallback a respuestas mock si falla la API
- Validación de estructura de respuesta

**Archivo Complementario**: `applyUMLActions.ts`

**Responsabilidades:**
- Aplica acciones generadas por IA sobre diagramas
- No muta el diagrama original (clonación defensiva)
- Soporta múltiples tipos de acciones:
  - `CREATE_CLASS`, `UPDATE_CLASS`, `DELETE_CLASS`, `RENAME_CLASS`
  - `ADD_ATTRIBUTE`, `UPDATE_ATTRIBUTE`, `DELETE_ATTRIBUTE`
  - `ADD_METHOD`, `UPDATE_METHOD`, `DELETE_METHOD`
  - `CREATE_RELATION`, `UPDATE_RELATION`, `DELETE_RELATION`

**Características:**
- Validación de referencias (clases, relaciones)
- Generación de warnings para acciones inválidas
- Resolución de referencias por ID o nombre

### 6. Módulo de IA - Gemini (ai/gemini/)

**Archivo Principal**: `orchestrator.ts`

**Responsabilidades:**
- Procesamiento de imágenes a diagramas UML
- Integración con Google Gemini Vision API
- Preprocesamiento de imágenes (optimización)

**Flujo de Procesamiento:**
```
1. Recibir imagen (path o buffer)
2. Preprocesar imagen (redimensionar, optimizar)
3. Llamar a Gemini Vision API con prompt estructurado
4. Parsear respuesta JSON de Gemini
5. Normalizar estructura de diagrama
6. Retornar diagrama UML normalizado
```

**Archivos del Módulo:**
- `orchestrator.ts`: Orquestador principal
- `geminiClient.ts`: Cliente para API Gemini
- `ImageProcessor.ts`: Procesamiento de imágenes
- `visionParser.ts`: Parser de respuestas de visión
- `diagramBuilder.ts`: Constructor de diagramas desde respuestas
- `ocr.ts`: OCR para texto en imágenes

**Características:**
- Soporte para múltiples formatos de imagen (JPEG, PNG, WebP)
- Timeout configurable (60s por defecto)
- Fallback a heurísticas si falla la API
- Metadata de procesamiento (tiempo, tamaño, motor usado)

---

## 🎨 Patrones de Diseño

### 1. **Facade Pattern**
- `flutterGenerator.ts` actúa como facade para el módulo Flutter
- `routes/index.ts` actúa como facade para todas las rutas

### 2. **Orchestrator Pattern**
- `generator_flutter/orchestrator.ts`: Orquesta la generación Flutter
- `ai/gemini/orchestrator.ts`: Orquesta el procesamiento de imágenes

### 3. **Builder Pattern**
- Generadores de código construyen archivos paso a paso
- `projectBuilder.ts` construye la estructura del proyecto Flutter

### 4. **Singleton Pattern**
- Pool de conexiones PostgreSQL (una instancia global)
- Configuración de Socket.io (una instancia por servidor)

### 5. **Strategy Pattern**
- Diferentes estrategias de generación (Spring Boot vs Flutter)
- Diferentes proveedores de IA (OpenAI vs Gemini)

### 6. **Template Method Pattern**
- Plantillas de código reutilizables (`templates/`)
- Generación de archivos con plantillas parametrizadas

### 7. **Repository Pattern** (implícito)
- Separación entre lógica de negocio y persistencia
- Preparado para migración a ORM (Prisma/TypeORM)

---

## 🔄 Flujos de Datos

### Flujo 1: Generación de Proyecto Spring Boot

```
Cliente HTTP
    ↓ POST /api/generator/spring
routes/generator.ts
    ↓ Validación
generator/springBootGenerator.ts
    ↓ generateSpringBootProject()
    ├── createProjectStructure()
    ├── generateMavenFiles()
    ├── generateEntities()
    ├── generateDTOs()
    ├── generateRepositories()
    ├── generateServices()
    ├── generateControllers()
    ├── generatePostmanCollection()
    └── createZipFile()
    ↓ Buffer ZIP
Cliente HTTP (download)
```

### Flujo 2: Colaboración en Tiempo Real

```
Cliente A (Socket.io)
    ↓ diagram:update
collaboration/socketHandlers.ts
    ↓ Broadcast a room
Cliente B, C, D (Socket.io)
    ↓ Reciben diagram:update
Actualizan estado local
```

### Flujo 3: Generación desde Imagen

```
Cliente HTTP
    ↓ POST /api/ai/image-to-diagram (multipart/form-data)
routes/ai_image_geminis.ts
    ↓ Multer (memoryStorage)
ai/gemini/orchestrator.ts
    ├── handleImageBufferToDiagram()
    ├── ImageProcessor.preprocessImage()
    ├── geminiClient.callGemini()
    └── visionParser.parseResponse()
    ↓ Diagrama UML normalizado
Cliente HTTP (JSON response)
```

### Flujo 4: Modificación de Diagrama con IA

```
Cliente HTTP
    ↓ POST /api/ai/modify-diagram
routes/ai.ts
    ↓ Validación
ai/openaiService.ts
    ├── modifyDiagramFromText()
    └── OpenAI API (genera acciones)
    ↓ UMLActionResponse
ai/applyUMLActions.ts
    ├── applyActionsToDiagram()
    └── Diagrama actualizado
    ↓ JSON response
Cliente HTTP
```

---

## 🔗 Interacciones entre Componentes

### Diagrama de Dependencias

```
index.ts
├── routes/index.ts
│   ├── routes/generator.ts
│   │   ├── generator/springBootGenerator.ts
│   │   └── generator_flutter/flutterGenerator.ts
│   ├── routes/ai.ts
│   │   ├── ai/openaiService.ts
│   │   └── ai/applyUMLActions.ts
│   └── routes/ai_image_geminis.ts
│       └── ai/gemini/orchestrator.ts
├── collaboration/socketHandlers.ts
│   └── (usa rooms en memoria)
└── db/connection.ts
    └── (usa pg Pool)
```

### Tipos Compartidos

**`types/uml.ts`** define interfaces compartidas:
- `UMLAttribute`
- `UMLMethod`
- `UMLRelation`
- `UMLClass`
- `UMLDiagramJSON`

**Usado por:**
- Generadores (Spring Boot, Flutter)
- Servicios de IA
- Handlers de colaboración
- Rutas de API

---

## 🔑 Puntos Clave de Implementación

### 1. **Gestión de Archivos Temporales**

**Problema**: Los generadores crean muchos archivos temporales que deben limpiarse.

**Solución**:
- Directorios temporales con timestamps/UUIDs únicos
- Limpieza automática después de generar ZIP
- Reintentos para Windows (EPERM/EBUSY)
- Try-finally para garantizar limpieza en errores

**Ejemplo**:
```typescript
const tempDir = path.join(process.cwd(), 'temp', `spring-project-${Date.now()}`);
try {
  // Generar proyecto...
  return zipBuffer;
} finally {
  await removeDirWithRetry(tempDir);
}
```

### 2. **Manejo de Errores Defensivo**

**Estrategia**:
- Validación de entrada en cada capa
- Try-catch en funciones críticas
- Fallback a respuestas mock si falla IA
- Logging estructurado de errores
- Middleware centralizado de errores

**Ejemplo**:
```typescript
try {
  const result = await callGemini(...);
} catch (error) {
  console.error('Error:', error);
  return getMockResponse(); // Fallback
}
```

### 3. **Normalización de Nombres**

**Problema**: Los nombres de clases UML pueden tener caracteres inválidos para Java/Dart.

**Solución**:
- Funciones de normalización (`toJavaClassName`, `toSafeName`)
- Validación de nombres válidos
- Prefijos automáticos si comienza con dígito

**Ejemplo**:
```typescript
function toJavaClassName(name: string): string {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const pascal = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  if (!/^[A-Za-z]/.test(pascal)) return `C${pascal}`;
  return pascal;
}
```

### 4. **Sistema de Locks para Colaboración**

**Problema**: Múltiples usuarios editando el mismo elemento simultáneamente.

**Solución**:
- Locks en memoria por `elementId`
- Expiración automática (5 minutos)
- Liberación al desconectar
- Broadcast de locks a todos los usuarios

**Estructura**:
```typescript
interface CollaborationLock {
  elementId: string;
  userId: string;
  timestamp: number;
}
```

### 5. **Procesamiento Asíncrono de Imágenes**

**Problema**: Procesamiento de imágenes puede ser lento.

**Solución**:
- Preprocesamiento opcional (redimensionar)
- Timeout configurable (60s)
- Procesamiento en buffer temporal
- Limpieza automática de archivos temporales

### 6. **Validación de Respuestas de IA**

**Problema**: Las respuestas de IA pueden ser inválidas o mal formateadas.

**Solución**:
- Validación de estructura JSON
- Parsing defensivo con try-catch
- Extracción de JSON de bloques markdown
- Fallback a heurísticas si falla parsing

**Ejemplo**:
```typescript
let jsonText = response.trim();
const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
if (jsonMatch) {
  jsonText = jsonMatch[1].trim();
}
const parsed = JSON.parse(jsonText);
```

---

## 📊 Métricas y Consideraciones

### Rendimiento

- **Generación Spring Boot**: ~2-5 segundos (depende de número de clases)
- **Generación Flutter**: ~5-10 segundos (más complejo)
- **Procesamiento de Imagen**: ~10-60 segundos (depende de Gemini API)
- **Colaboración en Tiempo Real**: <100ms de latencia (WebSocket)

### Limitaciones Conocidas

1. **Archivos Temporales**: Pueden acumularse si hay errores no manejados
2. **Locks en Memoria**: Se pierden al reiniciar servidor
3. **Tamaño de Imágenes**: Límite de 10MB (configurable)
4. **Timeout de Gemini**: 60s puede ser insuficiente para imágenes grandes
5. **Pluralización**: Simple, no cubre todos los casos en inglés

### Mejoras Futuras

1. **Persistencia de Locks**: Guardar en base de datos
2. **Queue de Procesamiento**: Para tareas largas (generación)
3. **Caché de Respuestas**: Para sugerencias de IA repetidas
4. **Validación Avanzada**: Usar Zod para validación de tipos
5. **Tests Unitarios**: Cobertura completa de generadores

---

## 🎓 Conclusiones

La arquitectura de `server/src` está bien estructurada con:

✅ **Separación clara de responsabilidades**
✅ **Modularidad y reutilización**
✅ **Manejo robusto de errores**
✅ **Tipado fuerte con TypeScript**
✅ **Escalabilidad preparada**

**Fortalezas:**
- Código limpio y mantenible
- Patrones de diseño bien aplicados
- Documentación en código (JSDoc)
- Manejo defensivo de casos edge

**Áreas de Mejora:**
- Tests automatizados
- Validación más estricta (Zod)
- Persistencia de estado de colaboración
- Optimización de generación de código

---

*Documento generado automáticamente - Análisis completo de server/src*

