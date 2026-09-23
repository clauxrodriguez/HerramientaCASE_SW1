## Resumen ejecutivo

Este documento analiza a profundidad la carpeta `server/src` del proyecto PRIMER-PARCIAL-SW. Describe módulos clave, responsabilidades, flujos principales, interacciones con el `frontend` y servicios externos (IA, DB), patrones arquitectónicos, riesgos y recomendaciones prácticas.

Fecha: 2025-11-08
Autor: Análisis automatizado (guardado en repo)

## Contrato corto (inputs/outputs)
- Input: Peticiones HTTP/WebSocket desde el `frontend`, archivos de imagen para OCR/IA, modelos de datos UML (JSON) para generación.
- Output: Endpoints HTTP que exponen IA, generación de código/artefactos, APIs colaborativas en tiempo real (sockets), acceso a la base de datos.
- Error modes: errores en llamadas a IA externa, fallas en DB, problemas en la orquestación de generadores.

## Mapa de alto nivel (carpetas y responsabilidades)
- `index.ts` — Arranque del servidor y exportación de rutas/servidor.
- `ai/` — Lógica de IA que incluye:
  - `applyUMLActions.ts` y su test `applyUMLActions.test.ts` — Aplicación de transformaciones/acciones sobre modelos UML.
  - `openaiService.ts` — Abstracción para llamadas a OpenAI u otros proveedores (posiblemente con fallback a la carpeta `gemini`).
  - `runApplyUMLActions.ts` — Utilidad para ejecutar los tests/acciones.
  - `gemini/` — Implementaciones específicas para un proveedor llamado "Gemini": `diagramBuilder.ts`, `geminiClient.ts`, `ImageProcessor.ts`, `ocr.ts`, `orchestrator.ts`, `visionParser.ts`.

- `collaboration/` — Manejadores de sockets: `socketHandlers.ts` expone la lógica para la colaboración en tiempo real (unir usuarios a rooms, aplicar eventos de diagrama, broadcast/merge).

- `db/` — `connection.ts` define la conexión a la base de datos (probablemente Postgres o similar) y la inicialización.

- `generator/` — Generador principal para backend Spring Boot (`springBootGenerator.ts`) que toma modelos y produce proyecto/archivos.

- `generator_flutter/` — Orquestador y generadores para Flutter (plataformas habilitadas, plantillas, builders y templates). Carpeta con varios generadores y helpers (provisiona páginas, widgets y pubspec).

- `routes/` — Rutas HTTP expuestas por el servidor:
  - `ai_image_geminis.ts` — Endpoint(s) para recibir imágenes y procesarlas con la integración Gemini (OCR/vision).
  - `ai.ts` — Rutas relacionadas con IA (posible abstracción para llamadas a LLMs y transformaciones).
  - `generator.ts` — Endpoints que disparan la generación de proyectos/artefactos.
  - `index.ts` — Registro y montaje de rutas en el servidor.

- `types/` — Tipos para UML (`uml.ts`) compartidos por el backend; útiles para definir contratos JSON.

- `utils/` — Mapeos y utilidades (por ejemplo `relationMapper.ts`, `typeMapper.ts`) para transformar modelos UML a código/plantillas.

## Flujos clave y cómo interactúan con otros componentes

1) Frontend -> Procesamiento de imagen IA -> Backend
   - `frontend` envia imagen a endpoints en `routes/ai_image_geminis.ts`.
   - `ai_image_geminis` orquesta `gemini/ImageProcessor.ts` y `gemini/visionParser.ts` para OCR y extracción de estructura.
   - Resultado: JSON de diagrama que puede guardarse en DB o devolverse al cliente.

2) Frontend -> IA de texto / generación de diagramas
   - `routes/ai.ts` usa `ai/openaiService.ts` o la carpeta `gemini/` para solicitar transformaciones con LLMs.
   - `applyUMLActions.ts` aplica transformaciones (ej. crear relaciones, renombrar, normalizar) y está cubierto por tests.

3) Generación de proyectos (backend/frontend móvil)
   - `frontend` solicita generación a `routes/generator.ts`.
   - El generador orquesta `generator/` o `generator_flutter/` dependiendo del target. Usa `utils/typeMapper.ts` y `relationMapper.ts` para mapear modelos UML a artefactos de código.
   - Resultado empaquetado y devuelto (zip/archivos) o persistido en `generated/`.

4) Colaboración en tiempo real
   - `collaboration/socketHandlers.ts` recibe eventos socket del `frontend` y aplica cambios en memory o DB y broadcast a otros clientes.

5) DB
   - `db/connection.ts` gestiona la persistencia de diagramas/proyectos cuando es necesario (posible uso en endpoints de generación y colaboración).

## Patrones arquitectónicos observados
- Modularización por dominio: `ai`, `generator`, `generator_flutter`, `collaboration`.
- Orquestadores: módulos `orchestrator.ts` para coordinar pasos complejos (ej., `gemini/orchestrator.ts`, `generator_flutter/orchestrator.ts`).
- Adaptadores/Clients: `gemini/geminiClient.ts`, `openaiService.ts` funcionan como adaptadores para servicios externos.
- Separación entre transformaciones puras (`applyUMLActions.ts`) y efectos I/O (clients, file system, DB).
- Uso de tests unitarios imprescindibles para la lógica pura (ej. `applyUMLActions.test.ts`).

## Observaciones específicas (archivos notables)
- `ai/gemini/diagramBuilder.ts` y `visionParser.ts`: responsables de convertir salidas de OCR/vision en estructuras UML; revisar robustez y tolerancia a errores.
- `generator_flutter/` contiene plantillas y generadores para páginas/WT; puede beneficiarse de un contrato claro de entrada (shapes de UML) y tests de snapshot.
- `utils/typeMapper.ts` y `relationMapper.ts`: funciones críticas para mapear tipos UML a tipos de lenguaje — deben ser exhaustivamente testeadas y documentadas.

## Riesgos y puntos de atención
- Dependencia de proveedores IA: Latencia, cambios en APIs, límites de uso y costos. Encapsular y manejar reintentos/quotas.
- Transformaciones automáticas (vision -> UML): riesgo de datos mal interpretados; proveer validación y pasos de confirmación en frontend.
- Concurrencia/colaboración: estrategia de merge/conflicto en `socketHandlers.ts` debe ser revisada (¿OT/CRDT/locking?).
- Generación de proyectos: tamaño y seguridad (validar inputs para evitar escritura no autorizada en FS).

## Recomendaciones y próximos pasos
1. Documentar los contratos HTTP (request/response) de `routes/*` y generar tipos TypeScript compartidos (frontend <-> backend). Añadir un archivo `docs/api-contracts.md` o OpenAPI si procede.
2. Añadir tests de integración para los endpoints de IA (mock de cliente Gemini/OpenAI) y para `routes/generator.ts` (mock FS o usar carpeta temp `generated/`).
3. Auditar y reforzar la gestión de errores en `gemini/` (timeouts, reintentos) y añadir métricas/logging para entender fallos en producción.
4. Revisar `collaboration/socketHandlers.ts` para definir una estrategia de resolución de conflictos (si la aplicación crece, considerar CRDTs).
5. Añadir un script de limpieza/rotación para `generated/` y límites en el tamaño de generación por usuario.

## Artefacto creado
- Archivo: `docs/server-src-analysis.md` (este documento) — Ubicado en `docs/`.

---

Si quieres, puedo:
- Extraer los contratos concretos leyendo los handlers en `routes/ai.ts` y `routes/ai_image_geminis.ts` y generar tipos TS para `frontend/services/`.
- Crear tests de integración mocks para los endpoints IA.
- Añadir un `docs/api-contracts.md` o un archivo OpenAPI para los endpoints más usados.
