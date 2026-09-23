# Análisis del directorio `server/src`

Fecha: 2025-11-09
Autor: análisis automático (resumen humano-legible)

Este documento resume la estructura, responsabilidad y patrones del código dentro de `server/src`. Está diseñado para servir como referencia y punto de partida para refactorizaciones y optimizaciones.

## Resumen general

`server/src` contiene la lógica del backend del proyecto: rutas HTTP, integraciones con servicios AI (OpenAI/Gemini), generadores de código (Spring/Flutter), manejo de colaboración en tiempo real (sockets), conexión a BD y utilidades de mapeo de modelos UML. El código está organizado por dominios (ai, generator, generator_flutter, collaboration, db, routes, utils, types). Hay tests unitarios y scripts para correr conjuntos de pruebas.

## Punto de entrada

- `index.ts`
  - Probablemente inicializa el servidor HTTP, monta rutas definidas en `routes/` y arranca sockets (si aplica). Es el orquestador inicial que conecta las dependencias de más alto nivel.

## Carpetas y archivos (inventario con propósito)

- ai/
  - `applyUMLActions.ts` / `applyUMLActions.test.ts` — lógica para aplicar acciones (transformaciones) sobre un modelo UML, y tests asociados.
  - `openaiService.ts` — cliente/abstracción para llamadas a OpenAI (o similar); envuelve requests, formatea prompts y procesa respuestas.
  - `runApplyUMLActions.ts` — runner de pruebas/ejecuciones para `applyUMLActions`.
  - gemini/ — integración específica con el cliente "Gemini" (posible otro proveedor de LLM o una capa propia):
    - `geminiClient.ts` — cliente/SDK para comunicarse con Gemini.
    - `diagramBuilder.ts` — construcción de diagramas a partir de inputs del LLM (parseo/ensamblado).
    - `ImageProcessor.ts`, `visionParser.ts`, `ocr.ts` — procesamiento de imágenes/OCR/visión para extraer texto/diagramas.
    - `orchestrator.ts` — orquesta pasos (OCR → parser → builder → acciones sobre modelo).

- collaboration/
  - `socketHandlers.ts` — handlers para WebSocket (socket.io u otro) que permiten colaboración en tiempo real: emisión de eventos, sincronización de diagramas, locking/edición.

- db/
  - `connection.ts` — abstracción de la conexión a BD (pool, inicialización, utilidades). Usada por rutas u otros servicios que persisten/retrieven datos.

- generator/
  - `springBootGenerator.ts`, `postmanGenerator.ts` — generadores que traducen el modelo UML (o especificación) a proyectos/código (Spring Boot, colecciones Postman).
  - `Sample UML Diagram.json` — ejemplo de input utilidad para pruebas/manual testing.
  - `__tests__/` — tests que verifican funcionalidades del generador (relations, tipos, etc.).

- generator_flutter/
  - `flutterGenerator.ts`, `projectBuilder.ts`, `orchestrator.ts` — análogo a generator pero orientado a Flutter; incluye templates, generators por artefacto (model, route, service, widget), y helpers para empaquetado.
  - `templates/` y `generators/` — plantillas y motores de generación por pieza (reutilizables).

- utils/
  - `relationMapper.ts`, `typeMapper.ts` — mapeos entre tipos UML y tipos objetivo (Java, Dart), lógica para inferir relaciones y cardinalidades.

- routes/
  - `index.ts` — expone/recoge las rutas y monta sub-routers.
  - `ai_image_geminis.ts`, `ai.ts`, `generator.ts` — endpoints HTTP para:
    - subir imágenes y procesarlas con la pipeline AI
    - endpoints genéricos de AI (prompts, generación de texto/diagrama)
    - disparar generación de proyectos (Spring/Flutter/Postman)

- types/
  - `uml.ts` — definiciones TypeScript de los tipos centrales (UMLClass, UMLRelation, Diagram, etc.) compartidos por generadores y orquestadores.

- scripts/
  - `listTables.ts`, `run-smoke-generator.ts`, `showDiagrams.ts` — utilidades/scripts de desarrollo para inspección y generación rápida.

## Flujo de datos / interacciones clave

1. Cliente (frontend) → Rutas (`routes/`) — peticiones para:
   - subir imagen(es) o solicitar análisis (routes/ai_image_geminis.ts)
   - solicitar generación de proyecto desde un modelo (routes/generator.ts)
2. Rutas → Servicios AI (`ai/`)
   - `ai` llama a `openaiService` o `gemini` para analizar texto/imagen.
   - Si es imagen: `gemini/ImageProcessor` y `visionParser` extraen información; `orchestrator` coordina pasos.
3. Servicios AI → Transformers / Builders
   - `diagramBuilder` y `applyUMLActions` convierten la salida en un modelo UML interno (tipado en `types/uml.ts`).
4. Modelo UML → Generators
   - `generator/` o `generator_flutter/` reciben el modelo y, usando `utils/typeMapper` y `relationMapper`, convierten a artefactos del lenguaje destino y plantillas.
   - Los generators usan plantillas en `templates/` y crean árbol de proyecto en `temp/` o `generated/`.
5. Persistencia / Colaboración
   - Si el flujo requiere persistir, se usa `db/connection.ts` para guardar diagramas o metadatos.
   - `collaboration/socketHandlers.ts` permite sincronización en tiempo real entre clientes.

## Patrones y decisiones arquitectónicas detectadas

- Orchestrator/Coordinator pattern
  - Varios archivos `orchestrator.ts` orquestan pasos complejos (ej. OCR → parse → build → apply). Centralizan flujo y error handling.

- Adapter/Client wrapper
  - `openaiService.ts` y `gemini/geminiClient.ts` encapsulan llamadas externas y permiten cambiar proveedores sin tocar la lógica de alto nivel.

- Generator + Template pattern
  - Generadores (Spring/Flutter) combinan un mapeo de modelos → templates; se parece a un pattern factory + templates para código.

- Utilities (mappers)
  - `typeMapper` y `relationMapper` contienen reglas de conversión repetibles y deben ser fuente de verdad para tipos/relaciones.

- Tests orientados a regresión para generación
  - `__tests__` prueban producciones de código y mapeos, lo cual es crítico para evitar regresiones en generación.

- Tipado centralizado
  - `types/uml.ts` es la fuente única de tipos para el dominio UML; buen punto para mantener compatibilidad entre módulos.

## Funciones / archivos críticos (lista rápida)

- `ai/orchestrator.ts` — coordina el pipeline de visión/AI → diagrama.
- `ai/gemini/diagramBuilder.ts` — parser del output del LLM hacia modelo UML.
- `ai/applyUMLActions.ts` — aplica transformaciones/acciones sobre el modelo UML.
- `generator/springBootGenerator.ts` — genera artefactos Spring (controladores, entidades, repositorios).
- `generator_flutter/flutterGenerator.ts` — genera app Flutter (widgets, rutas, servicios).
- `routes/generator.ts` — expone la API que inicia el proceso de generación.
- `collaboration/socketHandlers.ts` — sincronización en tiempo real.
- `db/connection.ts` — conexión/gestión de BD (implica configuración y credenciales en `env`/`.env`).

## Riesgos y puntos de atención

- Llamadas a LLMs / servicios de visión:
  - Riesgo: latencia alta, rate limits, fallos transitorios. Se necesitan retries, backoff y timeouts bien definidos.
  - Recomendación: implementar una capa de reintentos y circuit breaker. Añadir métricas (latencia, fallos).

- Procesamiento de imágenes (CPU/IO intensivo):
  - Riesgo: bloqueos en el event loop si hay operaciones síncronas costosas.
  - Recomendación: usar workers o procesos separados para procesamiento pesado; limitar carga concurrente.

- Generación de código:
  - Riesgo: inputs ambiguos producen código inválido; tests parciales están pero cobertura puede no alcanzar todos los casos.
  - Recomendación: añadir más tests example-driven para casos límite y validación post-generación (lint/build rápido).

- Tipado y consistencia:
  - Riesgo: tipos compartidos deben mantenerse; divergencia provoca bugs silenciosos.
  - Recomendación: exportar y usar `types/uml.ts` en todos los módulos y añadir regression tests que validen contratos (shape de objetos).

- Manejo de errores y logs:
  - Recomendación: estandarizar logging (p. ej. pino/winston) con niveles y correlación de requestId para trazabilidad.

## Recomendaciones concretas (priorizadas)

1. (Alto) Añadir retrys/backoff y timeouts a las llamadas a LLM/vision. Implementar un wrapper reutilizable.
2. (Alto) Aislar el procesamiento intensivo de imágenes en background workers (child_process / worker_threads / cola con Bull/RabbitMQ si es necesario).
3. (Medio) Centralizar y documentar los tipos en `types/uml.ts` y crear un test que verifique que los generators consumen ese shape.
4. (Medio) Aumentar cobertura de tests de `applyUMLActions`, `diagramBuilder` y los generators (casos edge: herencia, relaciones complejas, tipos personalizados).
5. (Medio) Añadir métricas y tracing básicos (latencia AI, errores, tiempo de generación).
6. (Bajo) Mejorar la separación de responsabilidades extraendo lógica compleja a servicios puramente funcionales para facilitar tests unitarios.

## Ideas de optimización técnica

- Cache de resultados AI para inputs idénticos (keyed por hash del prompt + parámetros) para evitar repetir llamadas costosas.
- Pipeline en dos fases para generación: 1) análisis/validación del modelo 2) generación por piezas, permitiendo reintentos parciales.
- Añadir un esquema de versionado del modelo UML para soportar migraciones y retrocompatibilidad de templates.

## Mapa de llamadas simplificado (texto)

Frontend → routes/generator.ts → generator/orchestrator → utils/typeMapper/relationMapper → templates → filesystem (generated)

Frontend → routes/ai_image_geminis.ts → ai/orchestrator → gemini/ImageProcessor → visionParser → diagramBuilder → applyUMLActions → [persist/db] → response

Frontend (collab) ↔ socketHandlers ↔ store interno / eventos de broadcast

## Próximos pasos sugeridos (acción inmediata)

- Crear tests unitarios adicionales para `ai/diagramBuilder` y `applyUMLActions` (cobertura de casos complejos de relaciones).
- Añadir un script de smoke-test que valide que `generator/springBootGenerator` produce un proyecto compilable (mvn -q -DskipTests package) en un entorno contenedor.
- Implementar un wrapper con retries/timeouts para llamadas a LLM.

---

Si quieres, puedo:
- crear issues/tareas concretas en formato checklist (por prioridad) en este repo;
- abrir PRs con cambios pequeños (ejemplo: añadir wrapper de retry para `openaiService.ts` o tests adicionales);
- ejecutar los tests existentes (`npm test`) y reportar fallos actuales.

Dime qué prefieres que haga ahora (crear issues, añadir tests, o implementar un wrapper para LLM).