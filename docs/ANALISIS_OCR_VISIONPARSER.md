# Análisis Profundo: `ocr.ts` y `visionParser.ts`

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Propósito y Contexto](#propósito-y-contexto)
3. [Análisis de `ocr.ts`](#análisis-de-ocrts)
4. [Análisis de `visionParser.ts`](#análisis-de-visionparserts)
5. [Interacción entre Módulos](#interacción-entre-módulos)
6. [Flujos de Trabajo](#flujos-de-trabajo)
7. [Patrones de Diseño](#patrones-de-diseño)
8. [Dependencias y Fallbacks](#dependencias-y-fallbacks)
9. [Estado Actual y Uso](#estado-actual-y-uso)
10. [Recomendaciones](#recomendaciones)

---

## 🎯 Resumen Ejecutivo

### `ocr.ts` - Reconocimiento Óptico de Caracteres
**Propósito:** Extraer texto de imágenes de diagramas UML con información de posición (bounding boxes).

**Características:**
- ✅ Extrae texto con coordenadas (bbox)
- ✅ Agrupa palabras en líneas
- ✅ Múltiples fallbacks (Google Vision → Tesseract.js)
- ✅ Manejo robusto de errores

### `visionParser.ts` - Análisis de Formas Visuales
**Propósito:** Detectar formas geométricas (rectángulos, líneas) en imágenes de diagramas UML.

**Características:**
- ✅ Detecta rectángulos (clases UML)
- ✅ Detecta líneas (relaciones UML)
- ✅ Fusiona rectángulos superpuestos (IoU)
- ✅ Múltiples fallbacks (OpenCV → Google Vision)

### Relación
Ambos módulos son **complementarios** y se usan juntos en `diagramBuilder.ts`:
- `ocr.ts` → Extrae **texto** (nombres de clases, atributos)
- `visionParser.ts` → Extrae **formas** (cajas de clases, líneas de relaciones)
- `diagramBuilder.ts` → **Combina** ambos para construir modelo UML

---

## 🎯 Propósito y Contexto

### Contexto Arquitectónico
```
┌─────────────────────────────────────────┐
│      Análisis de Imágenes UML           │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │  visionParser│  │     ocr      │   │
│  │  (formas)    │  │   (texto)    │   │
│  └──────┬───────┘  └──────┬───────┘   │
│         │                  │           │
│         └────────┬──────────┘           │
│                  │                      │
│         ┌────────▼──────────┐          │
│         │  diagramBuilder   │          │
│         │  (combina ambos)  │          │
│         └────────┬──────────┘          │
│                  │                      │
│         ┌────────▼──────────┐          │
│         │   DiagramModel    │          │
│         │  (UML estructurado)│         │
│         └────────────────────┘          │
└─────────────────────────────────────────┘
```

### Estado Actual
**⚠️ IMPORTANTE:** Estos módulos **NO se están usando actualmente** en el flujo principal.

El flujo actual (`orchestrator.ts`) usa directamente **Gemini Vision API** para análisis completo de imágenes, sin necesidad de OCR/visionParser separados.

**Uso Potencial:**
- Fallback cuando Gemini no está disponible
- Análisis más granular (OCR + formas por separado)
- Validación cruzada con Gemini
- Análisis offline sin APIs externas

---

## 📄 Análisis de `ocr.ts`

### Estructura del Módulo

```typescript
ocr.ts
├── imageToBase64()          # Utilidad: convierte imagen a base64
├── runOCR()                 # Función principal
│   ├── Google Vision API    # Primera opción
│   │   ├── fullTextAnnotation (preferido)
│   │   │   └── Agrupa palabras en líneas
│   │   ├── textAnnotations (fallback)
│   │   │   └── Agrupa tokens en líneas
│   │   └── fullText (último fallback)
│   │       └── Sin bbox, solo texto
│   └── Tesseract.js         # Fallback final
│       └── Si Google Vision falla
└── Tipos exportados
    └── OCRText { text, bbox? }
```

### Función Principal: `runOCR(imagePath: string)`

**Entrada:**
- `imagePath`: Ruta al archivo de imagen

**Salida:**
- `Promise<OCRText[]>`: Array de textos con bounding boxes opcionales

**Tipo OCRText:**
```typescript
interface OCRText {
  text: string;                                    // Texto extraído
  bbox?: { x: number; y: number; w: number; h: number };  // Coordenadas opcionales
}
```

### Flujo de Procesamiento

#### 1. **Google Vision API (Preferido)**

**Endpoint:** `https://vision.googleapis.com/v1/images:annotate`
**Feature:** `DOCUMENT_TEXT_DETECTION`

**Flujo:**
```
1. Convertir imagen a base64
2. Llamar a Google Vision API
3. Procesar respuesta:
   a. fullTextAnnotation.pages (preferido)
      - Extrae palabras con bbox
      - Agrupa palabras en líneas por centerY
      - Calcula bbox unificado por línea
   b. textAnnotations (fallback)
      - Extrae tokens con bbox
      - Agrupa tokens en líneas
   c. fullText (último fallback)
      - Solo texto, sin bbox
```

**Algoritmo de Agrupación en Líneas:**
```typescript
1. Extraer palabras/tokens con bbox y centerY
2. Calcular threshold adaptativo:
   - medianH = mediana de alturas de palabras
   - yThreshold = max(6, medianH * 0.8)
3. Agrupar palabras por centerY:
   - Si |centerY1 - centerY2| <= yThreshold → misma línea
4. Ordenar palabras en línea por centerX (izq → der)
5. Calcular bbox unificado de la línea:
   - minX, minY = mínimos de todas las palabras
   - maxX, maxY = máximos de todas las palabras
   - w = maxX - minX, h = maxY - minY
```

**Ejemplo de Salida:**
```typescript
[
  { text: "Usuario", bbox: { x: 100, y: 50, w: 80, h: 20 } },
  { text: "+id: Long", bbox: { x: 100, y: 75, w: 100, h: 18 } },
  { text: "+nombre: String", bbox: { x: 100, y: 95, w: 150, h: 18 } }
]
```

#### 2. **Tesseract.js (Fallback)**

**Cuándo se usa:**
- Google Vision API no disponible (403, 400, error de red)
- `GOOGLE_API_KEY` no configurada

**Proceso:**
```typescript
1. Importar tesseract.js dinámicamente (require)
2. Llamar a Tesseract.recognize(imagePath, 'eng')
3. Procesar resultado:
   a. data.blocks → extraer líneas con bbox
   b. data.text → fallback sin bbox
```

**Características:**
- ✅ Funciona offline (sin APIs externas)
- ✅ No requiere API key
- ⚠️ Menor precisión que Google Vision
- ⚠️ Requiere instalar `tesseract.js` y `eng.traineddata`

### Manejo de Errores

**Estrategia de Fallbacks:**
```
Google Vision API
  ├── Éxito → Retornar OCRText[]
  ├── Error 403 (API no habilitada) → Log + Tesseract fallback
  ├── Error 400 (API key inválida) → Log + Tesseract fallback
  └── Otro error → Log + Tesseract fallback
      │
      └── Tesseract.js
          ├── Disponible → Retornar OCRText[]
          └── No disponible → Retornar []
```

**Códigos de Error Específicos:**
- `403`: API no habilitada o sin permisos (normal si no tienes Google Vision habilitada)
- `400`: API key inválida o mal formada
- Otros: Error de red, timeout, etc.

### Algoritmos Clave

#### 1. **Cálculo de Bounding Box desde Vértices**
```typescript
function bboxFromVertices(vertices: Array<{x?, y?}>): BBox {
  const xs = vertices.map(v => v.x ?? 0);
  const ys = vertices.map(v => v.y ?? 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    w: Math.round(maxX - minX),
    h: Math.round(maxY - minY)
  };
}
```

#### 2. **Agrupación de Palabras en Líneas**
```typescript
function clusterWordsIntoLines(words: WordItem[]): OCRText[] {
  // 1. Calcular threshold adaptativo
  const heights = words.map(w => w.bbox.h).filter(h => h > 0);
  const medianH = median(heights);
  const yThreshold = Math.max(6, Math.round(medianH * 0.8));
  
  // 2. Agrupar por centerY
  const lines: WordItem[][] = [];
  for (const word of words) {
    let placed = false;
    for (const line of lines) {
      if (Math.abs(word.centerY - line[0].centerY) <= yThreshold) {
        line.push(word);
        placed = true;
        break;
      }
    }
    if (!placed) lines.push([word]);
  }
  
  // 3. Ordenar palabras en línea por centerX
  // 4. Calcular bbox unificado
  return lines.map(line => {
    const sorted = line.sort((a, b) => a.centerX - b.centerX);
    const text = sorted.map(w => w.text).join(' ');
    const bbox = unionBBox(sorted.map(w => w.bbox));
    return { text: text.trim(), bbox };
  });
}
```

---

## 📄 Análisis de `visionParser.ts`

### Estructura del Módulo

```typescript
visionParser.ts
├── bboxFromVertices()       # Utilidad: calcula bbox desde vértices
├── iou()                    # Utilidad: Intersection over Union
├── mergeRects()             # Utilidad: fusiona rectángulos superpuestos
├── parseVisionShapes()      # Función principal
│   ├── OpenCV (preferido)   # Primera opción
│   │   ├── Detección de contornos
│   │   ├── Filtrado de rectángulos
│   │   ├── Detección de líneas (Hough)
│   │   └── Merge de rectángulos
│   └── Google Vision        # Fallback
│       ├── Extrae blocks/paragraphs
│       ├── Construye rectángulos
│       ├── Merge de rectángulos
│       └── Heurística de líneas
└── Tipos exportados
    └── Shape { type, bbox?, points? }
```

### Función Principal: `parseVisionShapes(imagePath: string)`

**Entrada:**
- `imagePath`: Ruta al archivo de imagen

**Salida:**
- `Promise<Shape[]>`: Array de formas detectadas

**Tipo Shape:**
```typescript
interface Shape {
  type: 'rect' | 'line' | 'arrow' | 'circle' | string;
  bbox?: { x: number; y: number; w: number; h: number };  // Para rect
  points?: Array<{ x: number; y: number }>;              // Para line
}
```

### Flujo de Procesamiento

#### 1. **OpenCV (Preferido)**

**Cuándo se usa:**
- `opencv4nodejs` está instalado

**Proceso:**
```
1. Cargar imagen (cv.imread)
2. Convertir a escala de grises (bgrToGray)
3. Aplicar blur gaussiano (gaussianBlur 5x5)
4. Detectar bordes (Canny 50-150)
5. Encontrar contornos (findContours)
6. Filtrar contornos:
   - Aproximar a polígono (approxPolyDP)
   - Si tiene 4 vértices y área > 2000 → rectángulo
7. Extraer bounding rect de cada rectángulo
8. Fusionar rectángulos superpuestos (mergeRects)
9. Detectar líneas (HoughLinesP)
10. Retornar shapes: rects + lines
```

**Parámetros OpenCV:**
- **Gaussian Blur:** `Size(5, 5)`, `sigma = 0`
- **Canny:** `lowThreshold = 50`, `highThreshold = 150`
- **Contours:** `RETR_LIST`, `CHAIN_APPROX_SIMPLE`
- **Polygon Approximation:** `epsilon = 0.02 * perimeter`
- **Min Area:** `2000` píxeles
- **Hough Lines:** `rho = 1`, `theta = π/180`, `threshold = 80`, `minLineLength = 30`, `maxLineGap = 10`

#### 2. **Google Vision API (Fallback)**

**Cuándo se usa:**
- OpenCV no disponible
- `GOOGLE_API_KEY` configurada

**Proceso:**
```
1. Llamar a Google Vision API (DOCUMENT_TEXT_DETECTION)
2. Extraer blocks/paragraphs con bbox:
   - Si bbox.w > 30 && bbox.h > 12 → rectángulo
   - Si no, intentar paragraphs dentro del block
3. Fusionar rectángulos superpuestos (mergeRects, threshold 0.3)
4. Heurística de líneas:
   - Conectar centros de rectángulos si:
     * Ángulo horizontal/vertical (±0.35 rad)
     * Distancia < max(w1, w2) * 6
     * Distancia > 10 píxeles
5. Retornar shapes: rects + lines
```

### Algoritmos Clave

#### 1. **Intersection over Union (IoU)**
```typescript
function iou(a: BBox, b: BBox): number {
  // Calcular intersección
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  
  // Calcular unión
  const union = a.w * a.h + b.w * b.h - inter;
  
  return union <= 0 ? 0 : inter / union;
}
```

**Propósito:** Medir solapamiento entre dos rectángulos (0 = sin solapamiento, 1 = completamente solapados).

#### 2. **Merge de Rectángulos Superpuestos**
```typescript
function mergeRects(rects: BBox[], threshold = 0.35): BBox[] {
  const merged: BBox[] = [];
  const used = new Array(rects.length).fill(false);
  
  for (let i = 0; i < rects.length; i++) {
    if (used[i]) continue;
    
    let base = { ...rects[i] };
    used[i] = true;
    
    // Buscar rectángulos superpuestos
    for (let j = i + 1; j < rects.length; j++) {
      if (used[j]) continue;
      
      if (iou(base, rects[j]) > threshold) {
        // Fusionar por unión
        const minX = Math.min(base.x, rects[j].x);
        const minY = Math.min(base.y, rects[j].y);
        const maxX = Math.max(base.x + base.w, rects[j].x + rects[j].w);
        const maxY = Math.max(base.y + base.h, rects[j].y + rects[j].h);
        base = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        used[j] = true;
      }
    }
    
    merged.push(base);
  }
  
  return merged;
}
```

**Propósito:** Fusionar rectángulos que se solapan significativamente (IoU > threshold) para evitar duplicados.

**Thresholds:**
- OpenCV: `0.35` (35% de solapamiento)
- Google Vision: `0.3` (30% de solapamiento)

#### 3. **Heurística de Líneas (Google Vision Fallback)**
```typescript
// Conectar centros de rectángulos si:
for (let i = 0; i < merged.length; i++) {
  for (let j = i + 1; j < merged.length; j++) {
    const a = merged[i], b = merged[j];
    const ax = a.x + a.w/2, ay = a.y + a.h/2;  // Centro de a
    const bx = b.x + b.w/2, by = b.y + b.h/2;  // Centro de b
    
    const dx = bx - ax, dy = by - ay;
    const dist = Math.hypot(dx, dy);
    const angle = Math.abs(Math.atan2(dy, dx));
    
    // Criterios:
    const angleOk = (Math.abs(angle) < 0.35) ||           // Horizontal
                    (Math.abs(angle - Math.PI/2) < 0.35); // Vertical
    const distOk = dist < Math.max(a.w, b.w) * 6 && dist > 10;
    
    if (angleOk && distOk) {
      shapes.push({ type: 'line', points: [{ x: ax, y: ay }, { x: bx, y: by }] });
    }
  }
}
```

**Propósito:** Detectar líneas conectando rectángulos cuando OpenCV no está disponible.

### Manejo de Errores

**Estrategia de Fallbacks:**
```
OpenCV
  ├── Disponible → Detectar formas → Retornar Shape[]
  └── No disponible → Google Vision fallback
      │
      └── Google Vision API
          ├── Disponible → Extraer formas → Retornar Shape[]
          └── No disponible → Retornar []
```

**Errores Específicos:**
- OpenCV no instalado: Silenciosamente continúa a fallback
- Google Vision 403: Log + retornar []
- Google Vision otros errores: Log + retornar []

---

## 🔗 Interacción entre Módulos

### Flujo Completo con `diagramBuilder.ts`

```typescript
// 1. Extraer formas de la imagen
const shapes = await parseVisionShapes(imagePath);
// Resultado: [{ type: 'rect', bbox: {...} }, { type: 'line', points: [...] }]

// 2. Extraer texto de la imagen
const ocrTexts = await runOCR(imagePath);
// Resultado: [{ text: "Usuario", bbox: {...} }, { text: "+id: Long", bbox: {...} }]

// 3. Combinar formas y texto en modelo UML
const diagram = buildDiagram(shapes, ocrTexts);
// Resultado: { classes: [...], relations: [...] }
```

### Algoritmo de `buildDiagram()`

**Paso 1: Asociar Texto a Rectángulos**
```typescript
for each rect in shapes where type === 'rect':
  // Encontrar textos cuyo centro está dentro del rectángulo
  texts = ocrTexts.filter(t => 
    center(t.bbox) está dentro de rect.bbox
  );
  
  // Primera línea = nombre de clase
  // Resto = atributos
  name = texts[0] || "ClassN";
  attributes = texts.slice(1);
  
  classes.push({ id, name, attributes, bbox: rect.bbox });
```

**Paso 2: Detectar Relaciones desde Líneas**
```typescript
for each line in shapes where type === 'line':
  start = line.points[0];
  end = line.points[line.points.length - 1];
  
  // Encontrar clase más cercana al inicio
  from = findClosestClass(start);
  
  // Encontrar clase más cercana al final
  to = findClosestClass(end);
  
  relations.push({ from: from.id, to: to.id, type: 'association' });
```

**Paso 3: Fallback sin Rectángulos**
```typescript
if (classes.length === 0 && ocrTexts.length > 0):
  // Dividir texto en bloques (separados por líneas vacías)
  blocks = ocrTexts.join('\n\n').split(/\n\s*\n/);
  
  for each block:
    lines = block.split(/\n/);
    name = lines[0];
    attributes = lines.slice(1);
    classes.push({ id, name, attributes });
```

---

## 🔄 Flujos de Trabajo

### Flujo 1: Análisis Completo de Imagen UML

```
┌─────────────────────────────────────────┐
│         Imagen UML (input)              │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌──────────┐        ┌──────────┐
│visionParser│       │   ocr    │
│ (formas)  │       │  (texto)  │
└─────┬─────┘       └─────┬─────┘
      │                    │
      │  shapes: Shape[]   │  ocrTexts: OCRText[]
      │                    │
      └──────────┬─────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ diagramBuilder  │
        │  buildDiagram() │
        └────────┬─────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  DiagramModel   │
        │ {classes, rels} │
        └─────────────────┘
```

### Flujo 2: Procesamiento OCR (Google Vision)

```
Imagen → Base64
    ↓
Google Vision API (DOCUMENT_TEXT_DETECTION)
    ↓
Respuesta JSON
    ├── fullTextAnnotation.pages (preferido)
    │   └── Extraer palabras → Agrupar en líneas
    ├── textAnnotations (fallback)
    │   └── Extraer tokens → Agrupar en líneas
    └── fullText (último fallback)
        └── Solo texto, sin bbox
    ↓
OCRText[] con bbox
```

### Flujo 3: Procesamiento de Formas (OpenCV)

```
Imagen
    ↓
OpenCV: Cargar imagen
    ↓
Convertir a escala de grises
    ↓
Blur gaussiano (5x5)
    ↓
Canny edge detection (50-150)
    ↓
Find contours
    ↓
Filtrar: 4 vértices + área > 2000
    ↓
Extraer bounding rects
    ↓
Merge rects superpuestos (IoU > 0.35)
    ↓
Hough lines detection
    ↓
Shape[] { rects, lines }
```

---

## 🎨 Patrones de Diseño

### 1. **Strategy Pattern**
- Múltiples estrategias de OCR (Google Vision vs Tesseract)
- Múltiples estrategias de detección de formas (OpenCV vs Google Vision)

### 2. **Fallback Chain Pattern**
- Cadena de fallbacks: Primera opción → Segunda opción → Última opción
- Manejo robusto de errores con degradación gradual

### 3. **Adapter Pattern**
- Adapta diferentes APIs (Google Vision, Tesseract, OpenCV) a interfaces comunes
- `OCRText` y `Shape` son interfaces unificadas

### 4. **Factory Pattern (implícito)**
- `runOCR()` y `parseVisionShapes()` actúan como factories que seleccionan la estrategia correcta

### 5. **Template Method Pattern**
- Algoritmo común de agrupación en líneas con diferentes fuentes de datos

---

## 🔧 Dependencias y Fallbacks

### Dependencias Externas

#### `ocr.ts`
1. **Google Vision API** (preferido)
   - Requiere: `GOOGLE_API_KEY` en `.env`
   - Endpoint: `https://vision.googleapis.com/v1/images:annotate`
   - Feature: `DOCUMENT_TEXT_DETECTION`
   - Costo: API de pago (con tier gratuito)

2. **Tesseract.js** (fallback)
   - Requiere: `npm install tesseract.js`
   - Requiere: `eng.traineddata` (archivo de idioma)
   - Costo: Gratis, offline

#### `visionParser.ts`
1. **OpenCV** (preferido)
   - Requiere: `npm install opencv4nodejs`
   - Requiere: Binarios nativos de OpenCV
   - Costo: Gratis, offline

2. **Google Vision API** (fallback)
   - Requiere: `GOOGLE_API_KEY` en `.env`
   - Endpoint: `https://vision.googleapis.com/v1/images:annotate`
   - Feature: `DOCUMENT_TEXT_DETECTION`
   - Costo: API de pago (con tier gratuito)

### Matriz de Disponibilidad

| Módulo | Primera Opción | Fallback | Sin Dependencias |
|--------|---------------|----------|------------------|
| `ocr.ts` | Google Vision | Tesseract.js | ❌ Retorna [] |
| `visionParser.ts` | OpenCV | Google Vision | ❌ Retorna [] |

### Configuración Requerida

```env
# .env
GOOGLE_API_KEY=AIza...  # Para Google Vision API (OCR y visionParser fallback)
```

```bash
# package.json (opcional, para fallbacks offline)
npm install tesseract.js      # Para OCR offline
npm install opencv4nodejs     # Para detección de formas offline
```

---

## 📊 Estado Actual y Uso

### Estado Actual

**⚠️ NO SE ESTÁN USANDO EN EL FLUJO PRINCIPAL**

El flujo actual (`orchestrator.ts`) usa directamente **Gemini Vision API** para análisis completo de imágenes, sin necesidad de estos módulos.

### Uso Potencial

Estos módulos podrían usarse para:

1. **Fallback cuando Gemini no está disponible**
   ```typescript
   // En orchestrator.ts
   try {
     const result = await callGemini({ prompt, imagePath });
   } catch (err) {
     // Fallback a OCR + visionParser
     const shapes = await parseVisionShapes(imagePath);
     const ocrTexts = await runOCR(imagePath);
     const diagram = buildDiagram(shapes, ocrTexts);
   }
   ```

2. **Análisis más granular**
   - Separar extracción de texto y formas
   - Validación cruzada con Gemini
   - Análisis incremental

3. **Análisis offline**
   - Sin necesidad de APIs externas (usando Tesseract + OpenCV)
   - Útil para desarrollo/testing

4. **Validación y mejora**
   - Comparar resultados de Gemini vs OCR+visionParser
   - Mejorar precisión combinando ambos enfoques

### Integración Sugerida

```typescript
// En orchestrator.ts
export async function handleImageToDiagram(
  inputPath: string,
  options?: { useLLM?: boolean; useFallback?: boolean }
): Promise<OrchestratorResult> {
  const useLLM = options?.useLLM !== false;
  const useFallback = options?.useFallback === true;
  
  if (useLLM) {
    try {
      // Intentar Gemini primero
      const gemini = await callGemini({ prompt, imagePath });
      if (gemini.normalized) {
        return { diagram: gemini.normalized, geminiNormalized: gemini.normalized };
      }
    } catch (err) {
      if (!useFallback) throw err;
    }
  }
  
  // Fallback: OCR + visionParser
  if (useFallback) {
    const shapes = await parseVisionShapes(inputPath);
    const ocrTexts = await runOCR(inputPath);
    const diagram = buildDiagram(shapes, ocrTexts);
    return { diagram, geminiNormalized: null };
  }
  
  return { diagram: { classes: [], relations: [] }, geminiNormalized: null };
}
```

---

## 💡 Recomendaciones

### 1. **Integración con Flujo Principal**
- ✅ Integrar como fallback en `orchestrator.ts`
- ✅ Agregar opción `useFallback` en las rutas
- ✅ Documentar cuándo usar cada enfoque

### 2. **Mejoras de Precisión**
- 🔄 Ajustar thresholds de agrupación (yThreshold)
- 🔄 Mejorar heurística de asociación texto-rectángulo
- 🔄 Agregar validación de resultados

### 3. **Optimización de Performance**
- ⚡ Cachear resultados de OCR/visionParser
- ⚡ Procesar en paralelo (OCR + visionParser)
- ⚡ Optimizar algoritmos de agrupación

### 4. **Manejo de Errores**
- 🛡️ Agregar más logging detallado
- 🛡️ Retornar códigos de error específicos
- 🛡️ Validar entrada (formato de imagen, tamaño)

### 5. **Testing**
- 🧪 Tests unitarios para algoritmos clave (IoU, mergeRects, agrupación)
- 🧪 Tests de integración con imágenes de ejemplo
- 🧪 Comparar resultados con Gemini

### 6. **Documentación**
- 📝 Documentar algoritmos y thresholds
- 📝 Agregar ejemplos de uso
- 📝 Documentar dependencias y configuración

---

## 📝 Resumen de Algoritmos

### OCR - Agrupación en Líneas
1. Extraer palabras/tokens con bbox y centerY
2. Calcular threshold adaptativo: `yThreshold = max(6, medianH * 0.8)`
3. Agrupar por centerY: `|centerY1 - centerY2| <= yThreshold`
4. Ordenar por centerX (izq → der)
5. Calcular bbox unificado

### Vision Parser - Merge de Rectángulos
1. Calcular IoU entre todos los pares de rectángulos
2. Si `IoU > threshold` (0.35 o 0.3) → fusionar
3. Fusionar por unión de bounding boxes
4. Retornar rectángulos fusionados

### Diagram Builder - Asociación Texto-Forma
1. Para cada rectángulo, encontrar textos cuyo centro está dentro
2. Primera línea de texto = nombre de clase
3. Resto de líneas = atributos
4. Para cada línea, encontrar clases más cercanas a inicio/fin
5. Crear relación entre clases

---

*Documento generado: Análisis completo de `ocr.ts` y `visionParser.ts`*
*Última actualización: Análisis de módulos de análisis de imágenes*

