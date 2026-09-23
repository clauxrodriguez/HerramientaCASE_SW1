# Análisis Profundo del Módulo Canvas (Frontend)

## 1. Propósito General
El módulo `Canvas` implementa un editor visual de diagramas UML con soporte para:
- Renderizado de clases y relaciones usando **react-konva** (sobre `Konva.Stage`).
- Interacciones ricas: selección, drag & drop, zoom + pan, creación guiada de relaciones, menú contextual y modal avanzado.
- Patrones de composición de UI: un contenedor orquestador (`Canvas.tsx`) + una vista puramente declarativa (`CanvasStage.tsx`) + nodos y relaciones especializados.
- Extensibilidad para relaciones MANY_TO_MANY mediante generación de una clase intermedia y representación visual compuesta.

## 2. Arquitectura Interna
### 2.1 Componentes Clave
| Componente | Rol | Notas |
|------------|-----|-------|
| `Canvas.tsx` | Orquestador principal. Maneja estado UI adicional (menús, modales), conecta hooks especializados y delega render puro a `CanvasStage`. | Contiene lógica de unión: decide si click va a selección o creación de relación. |
| `CanvasStage.tsx` | Vista declarativa del lienzo. Renderiza grid, líneas, nodos y relaciones. Minimiza lógica de negocio. | Usa memo para rendimiento; transforma eventos a handlers externos. |
| `ClassNode.tsx` | Adaptador entre datos de la clase y la vista. Maneja eventos locales (drag, select, connection start). | Coordina con hooks para persistir posición. |
| `ClassNodeView.tsx` | Renderiza la caja UML (nombre, atributos, métodos, handles). Sin lógica de negocio. | Cálculo dinámico de altura según atributos/métodos. |
| `ConnectionLine.tsx` | Representación de una relación simple (línea + adornos según tipo + cardinalidades). | Calcula intersecciones para no atravesar nodos. |
| `ManyToManyVisual.tsx` | Visualización sintética de una MANY_TO_MANY derivada que usa clase join. | Une dos clases y la clase join con líneas y un nodo central. |
| `RelationModal.tsx` | Modal avanzado para definir/editar relaciones (cardinalidades, tipo, join-config). | Genera metadata de clase intermedia en M:M. |
| `RelationContextMenu.tsx` | Menú contextual simple para editar/eliminar relación. | Posicionamiento absoluto dentro del contenedor. |
| `RelationCreator.tsx` | Panel flotante para seleccionar tipo durante creación (parece legado/no usado ahora). | Posible candidato a eliminación/refactor. |
| `createManyToMany.ts` | Helper funcional puro para crear relación M:M + clase join con metadata. | Prueba unitaria incluida (`createManyToMany.test.ts`). |

### 2.2 Hooks Especializados
| Hook | Responsabilidad | Detalles Técnicos |
|------|-----------------|-------------------|
| `useZoomPan` | Zoom centrado en cursor y panning del stage. | Limita escala [0.2, 2.5]; recalcula offset para zoom centrado. |
| `useCreacionRelaciones` | Flujo completo de creación de relaciones con línea temporal suavizada y modal. | Usa `requestAnimationFrame` para interpolar posición final (SMOOTH_FACTOR); desactiva drag de nodos al abrir modal. |
| `useSeleccionElementos` | Selección mutuamente excluyente (clase vs relación) + deselección por click vacío. | Previene selección durante drag verificando `evt.buttons`. |
| `useDragNodos` | Arrastre de clases + actualización en store + control del panning. | Reactiva panning al finalizar drag; redondea coordenadas. |
| `useDiagramStore` | Estado global (Zustand) para clases/relaciones seleccionadas y mutaciones CRUD. | Nombres interno español (`clases`, `relaciones`) vs consumo en Canvas con inglés (`classes`, `relations`). |

### 2.3 Flujo de Interacción (Resumen Secuencial)
1. Usuario selecciona una clase: `ClassNode` -> `onSelect` -> `useSeleccionElementos.manejarSeleccionClase` -> store.
2. Usuario inicia creación de relación: click en handle -> `Canvas.onConnectionStart` -> `useCreacionRelaciones.iniciarConexion` (set flags + animación).
3. Usuario hace click en clase destino: `Canvas.manejarClickClaseCombinado` -> `useCreacionRelaciones.manejarClickClase` -> abre modal.
4. Modal confirma: `RelationModal.onConfirm` -> crea relación (y opcional join class) -> store `addRelation` / `addClass`.
5. Render: `CanvasStage` recalcula líneas, detecta pares que forman join-group para MANY_TO_MANY y los sustituye por `ManyToManyVisual`.
6. Menú contextual: click derecho en una relación -> `ConnectionLine.onContextMenu` -> `Canvas.openRelationContextMenu` -> muestra menú con acciones.
7. Drag de clase: `ClassNodeView` (Konva.Group draggable) -> `onDragEnd` -> `useDragNodos.manejarFinArrastreNodo` -> actualiza store.
8. Zoom: rueda -> `useZoomPan.manejarRueda` -> ajusta escala y posición centrada en cursor.

### 2.4 Representación Visual de Relaciones
| Tipo | Render | Adornos |
|------|--------|---------|
| INHERITANCE | Línea directa | Triángulo sólido apuntando al target |
| COMPOSITION | Línea directa | Rombo sólido (cerrado) |
| AGGREGATION | Línea discontinua | Rombo hueco |
| MANY_TO_MANY | Tres líneas (A-mid, B-mid, mid-join) vía `ManyToManyVisual` | Nodo central pequeño + cardinalidades en círculos |
| ONE_TO_MANY / MANY_TO_ONE / ONE_TO_ONE | Línea directa | Cardinalidades en círculos intermedios |

## 3. Patrones Clave
### 3.1 Separación Orquestación vs Presentación
- `Canvas.tsx`: integra estado y lógica de negocio UI (modal, selección, contexto, multi-hook). Mantiene clean `CanvasStage` para rendimiento y claridad.
- Minimiza re-render cost: `CanvasStage` memo + datos serializados.

### 3.2 Mutaciones Funcionales vs Imperativas
- `createManyToMany` realiza copia profunda (`JSON.parse(JSON.stringify())`) para evitar efectos colaterales.
- Otros flujos (drag, addRelation) mutan vía Zustand set pero de forma inmutable en arrays (map/push sobre copia). Buen balance.

### 3.3 Interpolación de Movimiento (UX Suave)
- Animación del endpoint de línea mientras se decide relación (`requestAnimationFrame` + lerp con `SMOOTH_FACTOR`).
- Evita cambios bruscos y mejora percepción de fluidez.

### 3.4 Prevención de Interferencias de Eventos
- Selección condicionada por `evt.buttons` para no competir con drag.
- Desactivación global del draggable de nodos durante el modal de relación.
- Cancelación y reenabling en un `useEffect` que observa `mostrarModalRelacion`.

### 3.5 Detección de Grupos MANY_TO_MANY
- Heurística basada en dos relaciones apuntando al mismo target ID desde distintos sources para emitir `ManyToManyVisual`.
- Cardinalidades se pasan desde relaciones originales.
- Permite abstracción visual sin modificar estructura interna.

### 3.6 Cálculo de Intersección Líneas
- Cada `ConnectionLine` calcula intersección con borde del rectángulo para evitar que la línea toque el centro del nodo.
- Ratio mínimo entre radio horizontal/vertical para proyectar hacia borde.

## 4. Interacción con Otros Módulos
- Dependencia en `types/uml` para shape de `UMLClass`, `UMLRelation`, `Diagram` (consumida en TSX y hooks JS).
- `useDiagramStore` es la fuente de verdad; cualquier optimización futura podría migrar a tipado más estricto o persistencia remota (sync con backend).
- El generador backend (Spring Boot) podría consumir el diagrama final para exportar; necesitaría mapping 1:1 de tipos.

## 5. Riesgos / Debilidades Detectadas
| Área | Riesgo | Mitigación sugerida |
|------|--------|----------------------|
| Nomenclatura mixta (clases vs classes) | Fuente de bugs al mapear store vs diagram prop | Unificar naming a inglés (`classes`, `relations`) o proveer selector normalizador. |
| `RelationCreator.tsx` potencialmente obsoleto | Código muerto o confusión | Eliminar o documentar estado experimental. |
| Uso de `JSON.parse(JSON.stringify())` | Ineficiente para diagramas grandes; pierde tipos | Cambiar a copia estructurada iterativa / `structuredClone`. |
| Falta undo/redo | UX limitada | Introducir history stack en store (past/present/future). |
| Animación manual con RAF | Potencial fuga si hay error en cleanup | Asegurar `stopSmoothFollow` en todas las rutas (ya se incluye en cleanup). |
| No hay Snapping ni guías | Precisión manual | Agregar grid-snapping opcional (redondeo a múltiplos). |
| Cardinalidades en M:M heurística | Collisions en casos de >2 relaciones al mismo target | Guardar flag explícita en metadata de join class y usarlo en render. |
| Hardcoded estilo | Dificultad para theming | Extraer tokens a design system central. |

## 6. Posibles Optimización / Mejoras Futuras
1. Unificación de nomenclatura store (camelCase inglés).  
2. Exportador del diagrama a JSON persistente + autosave debounce.  
3. Undo/Redo con `immer` patches.  
4. Panel de propiedades lateral para edición in-place de atributos/métodos/clasificaciones.  
5. Snapping a grid + resize de nodos (alturas dinámicas según contenido editable).  
6. Virtualización para diagramas grandes (ocultar fuera de viewport).  
7. Modo selección múltiple (shift + drag box).  
8. Internacionalización de labels (actual mezcolanza español/inglés).  
9. Mejora MANY_TO_MANY: guardar relación compuesta como estructura única (sourceA, sourceB, joinId).  
10. Tests de interacción usando Playwright/Cypress para flujos críticos (crear clase, relación, drag, zoom).  

## 7. Data Flow Detallado (Creación de Relación)
```
Handle click (ClassNodeView Circle)
 → onConnectionPointClick
   → Canvas.onConnectionStart
     → useCreacionRelaciones.iniciarConexion
       - set inicioRelacion
       - set creandoRelacion
       - init smooth follow
Mouse move (Stage)
 → CanvasStage.onStageMouseMove
   → useCreacionRelaciones.manejarMovimientoMouse (actualiza targetPosRef)
Second class click
 → Canvas.manejarClickClaseCombinado
   → useCreacionRelaciones.manejarClickClase
       - set relacionPendiente
       - abrir modal (mostrarModalRelacion)
Modal confirm
 → RelationModal.onConfirm
   → Canvas confirmarRelacion (wrapper)
     → useCreacionRelaciones.confirmarRelacion
       - addRelation (store)
       - cleanup animation
Render loop
 → CanvasStage detecta join-group y dibuja visual correspondiente
```

## 8. Contrato Implícito de UMLClass / UMLRelation
### UMLClass (parcial)
```
{
  id: string,
  name: string,
  attributes: Array<{ name: string; type?: string; visibility?: string; nullable?: boolean; isId?: boolean }>,
  methods: Array<{ name: string; parameters?: Array<{ name: string; type: string }>; returnType?: string }>,
  position: { x: number; y: number },
  width: number,
  height: number,
  metadata?: { generatedJoinFor?: [string,string]; hiddenInCanvas?: boolean }
}
```
### UMLRelation (parcial)
```
{
  id: string,
  source: string,
  target: string,
  type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY' | 'INHERITANCE' | 'COMPOSITION' | 'AGGREGATION',
  sourceCardinality?: string,
  targetCardinality?: string,
  label?: string,
  mappedBy?: string,
  joinColumn?: string
}
```

## 9. Edge Cases Considerados
| Caso | Manejo Actual |
|------|---------------|
| Click mismo nodo al crear relación | Ignora y mantiene modo creación |
| Modal cancelado | Limpia estado, re-habilita drag |
| Falta posición en clase | `ClassNodeView` aplica fallback grid por índice |
| Zoom extremo < 0.2 o > 2.5 | Clamp en hook zoom |
| Drag iniciando durante selección | Selección bloqueada si `evt.buttons !== 0` |
| MANY_TO_MANY sin joinConfig | Modal crea join por defecto con nombre compuesto |

## 10. Recomendaciones de Refactor Prioritario
1. Extraer constantes de tipos de relación y cardinalidades a `constants/uml.ts` compartido.  
2. Consolidar `RelationCreator` (deprecado) y usar sólo `RelationModal`.  
3. Normalizar acceso al store: proporcionar selector memoizado para `diagram` y conversión española → inglesa.  
4. Adoptar TypeScript completo en hooks `.js` (migrar a `.ts`/`.tsx`).  
5. Añadir `useEffect` en `Canvas.tsx` para sincronizar selección al eliminar clases/relaciones (limpiar IDs huérfanos).  
6. Test unitario adicional para flujo completo de creación relación (mock store + simulación).  

## 11. Integración con Backend Futuro
- El diagrama se puede serializar y enviar al backend para generación de código (ya hay generador Spring en server).  
- Mantener consistencia de tipos: mapear cardinalidades / relation.type a anotaciones JPA (ya implementado en backend).  
- Metadata en join class permite lógica avanzada para `@JoinTable` o transformar a entidad puente con dos `@ManyToOne`.

## 12. Conclusión
El módulo Canvas presenta una arquitectura limpia separando orquestación y presentación, con hooks bien segmentados por responsabilidad. La interacción es rica (drag, zoom, modal, contexto) y extensible (MANY_TO_MANY join). Las mejoras prioritarias apuntan a robustez (naming, TS completo, refactor de código legado) y UX avanzada (undo/redo, snapping). Este documento sirve como referencia base para futuras optimizaciones y ampliaciones.

---
Última actualización: 2025-11-09
Autor: Análisis automatizado (Copilot)
