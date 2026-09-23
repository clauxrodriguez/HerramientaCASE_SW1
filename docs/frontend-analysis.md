## Resumen ejecutivo

Este documento contiene un análisis profundo de la carpeta `frontend` del proyecto PRIMER-PARCIAL-SW. Describe la estructura principal, responsabilidades de los componentes, cómo interactúa con el backend/servidor, patrones recurrentes, riesgos y recomendaciones para optimizaciones y pruebas.

## Contrato corto (inputs/outputs)
- Input: Código fuente en `frontend/` (React + TypeScript, Vite).
- Output: Interfaz de usuario que permite crear/editar diagramas UML, subir imágenes para conversión a diagramas, colaborar en tiempo real y generar código/artefactos mediante el servidor.
- Modo de error: Fallos de red, datos malformados desde el servidor, colisiones de colaboración en tiempo real.

## Mapa de alto nivel (carpetas clave)
- `src/` — Código fuente principal.
  - `App.tsx`, `main.tsx` — Punto de entrada React + Vite.
  - `components/Canvas/` — Lógica y vistas del editor de diagramas (nodos/clases, canvas, stage y hooks de interacción: drag, zoom, selección, creación de relaciones).
    - `Clase/` — Representación de nodos de clase (`ClassNode.tsx`, `ClassNodeView.tsx`).
    - `Diagramador/` — Canvas, stage y hooks (p. ej. `useDragNodos.js`, `useZoomPan.js`, `useSeleccionElementos.js`).
  - `components/Relaciones/` — Creación y visualización de relaciones (ManyToMany, ConnectionLine, RelationCreator, RelationModal). Incluye tests unitarios básicos para la lógica de creación (`__tests__/createManyToMany.test.ts`).
  - `components/Sidebar/` — Editor lateral con acciones, edición de clases y relaciones, serialización y hooks para interacción con backend y generación (`hooks/diagramSerializer.ts`, `hooks/useBackendGenerator.ts`, `hooks/useDiagramActions.ts`).
  - `components/imagenes_IA/` — Subida de imágenes para la funcionalidad IA (`ImageToDiagramUploader.tsx`).
  - `hooks/` — Hooks compartidos (e.g., `useSocket.ts` para colaboración en tiempo real).
  - `services/` — Abstracción de llamadas HTTP y lógica remota:
    - `aiService.ts` — Integración con endpoints IA del servidor.
    - `aiImageService.ts` — Subida / procesamiento de imágenes al backend.
    - `generatorService.ts` — Solicitudes de generación (código/diagrama) al servidor.
  - `store/` — Estado centralizado (probablemente Redux-toolkit): `useDiagramStore.ts` y slices `collaborationSlice.ts`, `diagramSlice.ts`, `relationsSlice.ts`.
  - `tests/` — Tests puntuales para serialización y lógica.

## Interacciones con otras partes del sistema
- Backend/API
  - `services/*` llama a endpoints del servidor (ej. rutas de IA, generación). Los nombres de servicio (`aiService`, `generatorService`) indican peticiones a rutas expuestas por `server/src/routes/ai.ts` y otros endpoints de generación.
  - `ImageToDiagramUploader` y `aiImageService` suben imágenes al servidor para convertirlas a diagramas.
  - `generatorService` pide generación de código o artefactos una vez el diagrama esté listo.

- Colaboración en tiempo real
  - `useSocket.ts` sugiere uso de WebSockets (socket.io u otro) para sincronizar el estado entre clientes. `collaborationSlice.ts` mantiene el estado colaborativo.

- Persistencia/local
  - `diagramSerializer.ts` contiene la lógica para serializar/deserializar diagramas (útil para import/export y para enviar al servidor).

## Patrones arquitectónicos observados
- Separación por responsabilidades:
  - `components/` (UI), `hooks/` (comportamiento reutilizable), `services/` (API), `store/` (estado)
- Hooks compuestos: `useDiagramActions`, `useDragNodos`, `useZoomPan` implementan interacción compleja como hooks reutilizables.
- Redux-toolkit (slices) para estado global: manejo de diagramas y colaboración.
- Servicios HTTP centralizados para desacoplar componentes de la API.
- Tests unitarios focalizados para lógica pura (p. ej., `createManyToMany` y `diagramSerializer`).

## Componentes y responsabilidades claves (detalle)
- Canvas / Stage (Editor)
  - `Canvas.tsx` y `CanvasStage.tsx` contienen renderizado de nodos y relaciones, y exponen hooks para manipulación. Los hooks manejan gestos: drag, zoom/pan, selección múltiple.

- Nodos de clase
  - `ClassNode.tsx`, `ClassNodeView.tsx`: render y edición interna (propiedades/atributos/métodos). Deben mantenerse ligeros; la mayor parte de la lógica compleja debe residir en hooks o en el store.

- Relaciones
  - `RelationCreator.tsx`, `RelationModal.tsx`, `ConnectionLine.tsx` se encargan de crear y visualizar conexiones entre nodos. `createManyToMany` encapsula la lógica de mapeo.

- Sidebar
  - Contiene formularios para editar clases/relaciones y botones de acción (export, generar, colaborar). Usa `useBackendGenerator` y `useDiagramActions` para disparar requests.

- IA y subida de imágenes
  - `ImageToDiagramUploader.tsx` + `aiImageService.ts`: subida de imágenes y petición al backend para reconocimiento/transformación a diagrama.

## Flujos comunes (ejemplos)
1. Usuario arrastra un nodo en el Canvas:
   - `useDragNodos` detecta movimiento y actualiza `diagramSlice`.
   - El cambio se sincroniza via `collaborationSlice`/socket si hay sesión colaborativa.

2. Usuario sube una imagen para convertir a diagrama:
   - `ImageToDiagramUploader` hace POST con multipart/form-data a `aiImageService`.
   - El backend procesa la imagen, responde con un diagrama (JSON) que `diagramSerializer` deserializa y carga en `diagramSlice`.

3. Generar código/artefacto desde el diagrama:
   - Sidebar -> `useBackendGenerator` -> `generatorService` -> backend genera y retorna artefactos / descargas.

## Riesgos y puntos de atención
- Sincronización: manejo de conflictos en colaboración en tiempo real. Revisar estrategia de merging y versionado (operational transforms / CRDT si se necesita consistencia fuerte).
- Error handling: validar y centralizar mensajes de error de `services/*` para ofrecer feedback claro al usuario.
- Validación de datos entrantes: `diagramSerializer` debe tolerar formatos parciales o versiones antiguas.
- Tests: Cobertura enfocada en serialización, creación de relaciones y hooks puros (drag/zoom/selection). Actualmente hay algunos tests pero puede ampliarse.

## Recomendaciones y próximas mejoras
1. Documentar los contratos de API usados por `services/*` (endpoints, shapes de request/response). Añadir tipos TypeScript que reflejen respuestas del servidor.
2. Implementar pruebas de integración para el flujo de imagen->diagrama (mock del backend) y para colaboración (tests de slices y sockets con mocks).
3. Añadir validaciones/guards en `diagramSerializer` para detectar versiones incompatibles y migrarlas.
4. Revisar la lógica de colaboración: si la app crece es recomendable estudiar CRDTs o un approach con locking optimista para evitar sobrescrituras.
5. Añadir un README corto dentro de `frontend/` que documente estructura y comandos de desarrollo (vite, tests) y el flujo de trabajo colaborativo.

## Artefacto creado
- Archivo: `docs/frontend-analysis.md` (este documento) — Ubicado en la raíz `docs/` para fácil referencia.

## Próximos pasos sugeridos (acción práctica)
- (Corto plazo) Añadir tipos TS para las respuestas de `aiService` y `generatorService`.
- (Medio plazo) Implementar tests de integración para `aiImageService` y `diagramSerializer`.
- (Mediano/alto) Revisar y mejorar estrategia de sincronización en `collaborationSlice` / `useSocket.ts`.

---
Fecha: 2025-11-08
Autor: Análisis automatizado (generado y versionado en repo)
