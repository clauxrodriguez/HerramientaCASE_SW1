# Guía de Uso: Servicio de Imagen a Diagrama UML

## 📋 Resumen

El servicio `aiImageService.ts` permite subir una imagen de un diagrama UML y convertirla automáticamente en un diagrama UML estructurado usando Google Gemini Vision API.

---

## 🔄 Flujo Completo

```
Usuario selecciona imagen
    ↓
ActionButtons.tsx → handleUploadImage
    ↓
useDiagramActions.ts → handleUploadImage()
    ↓
aiImageService.ts → uploadImageFile()
    ↓
POST /api/ai/image-to-diagram (multipart/form-data)
    ↓
routes/ai_image_geminis.ts → handleImageBufferToDiagram()
    ↓
orchestrator.ts → callGemini()
    ↓
geminiClient.ts → Gemini Vision API
    ↓
Respuesta: { diagram: { classes, relations }, meta }
    ↓
convertApiResultToUMLDiagram() → Convierte formato API a UMLDiagram
    ↓
setDiagram() → Actualiza el store
    ↓
UI se actualiza automáticamente
```

---

## 📁 Archivos Involucrados

### Frontend

1. **`frontend/src/services/aiImageService.ts`**
   - Servicio principal para subir imágenes
   - Función: `uploadImageFile(file, options, onProgress)`
   - Retorna: `ParseDiagramResult`

2. **`frontend/src/components/Sidebar/hooks/useDiagramActions.ts`**
   - Hook que contiene `handleUploadImage()`
   - Función de conversión: `convertApiResultToUMLDiagram()`
   - Convierte formato API → UMLDiagram

3. **`frontend/src/components/Sidebar/components/ActionButtons.tsx`**
   - Componente UI con botón "Subir imagen"
   - Llama a `onUploadImage` handler

4. **`frontend/src/components/Sidebar/Sidebar.tsx`**
   - Componente principal que conecta todo
   - Pasa `handleUploadImage` a `ActionButtons`

### Backend

1. **`server/src/routes/ai_image_geminis.ts`**
   - Ruta: `POST /api/ai/image-to-diagram`
   - Maneja multipart/form-data con multer
   - Llama a `handleImageBufferToDiagram()`

2. **`server/src/ai/gemini/orchestrator.ts`**
   - Orquesta el proceso de análisis
   - Preprocesa imagen
   - Llama a Gemini API

3. **`server/src/ai/gemini/geminiClient.ts`**
   - Cliente para Gemini Vision API
   - Construye payload y maneja respuestas

---

## 🎯 Cómo Usar el Servicio

### 1. Desde el Frontend (React)

```typescript
import { uploadImageFile } from '../../services/aiImageService';

// En un componente o hook
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    // Subir imagen con opciones
    const result = await uploadImageFile(file, {
      lang: 'es',      // Idioma para el análisis
      useLLM: true    // Usar IA (true) o fallback (false)
    });

    // Resultado contiene:
    // - result.diagram: { classes, relations }
    // - result.meta: { engine, model, elapsed, ... }

    console.log('Diagrama generado:', result.diagram);
    console.log('Metadata:', result.meta);

  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 2. Usando el Handler Integrado

El handler `handleUploadImage` ya está integrado en `useDiagramActions`:

```typescript
// En Sidebar.tsx o cualquier componente
const { handleUploadImage } = useDiagramActions();

// Pasar al componente ActionButtons
<ActionButtons onUploadImage={handleUploadImage} />
```

### 3. Desde el Backend (Directo)

```typescript
import { handleImageBufferToDiagram } from './ai/gemini/orchestrator';

// En una ruta Express
router.post('/image-to-diagram', upload.single('file'), async (req, res) => {
  const imageBuffer = req.file.buffer;
  
  const result = await handleImageBufferToDiagram(imageBuffer, {
    language: 'es',
    useLLM: true,
    mimeType: req.file.mimetype,
    originalName: req.file.originalname
  });

  res.json({
    diagram: result.diagram,
    meta: {
      engine: result.geminiNormalized ? 'gemini' : 'fallback',
      elapsed: '...',
      ...
    }
  });
});
```

---

## 🔄 Conversión de Formatos

### Formato del API (Gemini)

```typescript
{
  diagram: {
    classes: [
      {
        id: "c1",
        name: "Usuario",
        attributes: ["+id: Long", "-nombre: String", "+email: String"]
      }
    ],
    relations: [
      {
        from: "c1",
        to: "c2",
        type: "ONE_TO_MANY"
      }
    ]
  },
  meta: {
    engine: "gemini",
    model: "gemini-1.5-pro-latest",
    elapsed: "2.5s"
  }
}
```

### Formato del Store (UMLDiagram)

```typescript
{
  id: "diagram-123",
  name: "Diagrama desde Imagen",
  package: "com.example",
  classes: [
    {
      id: "ai-class-123-0",
      name: "Usuario",
      attributes: [
        { name: "id", type: "Long", isId: true },
        { name: "nombre", type: "String", nullable: false },
        { name: "email", type: "String", unique: false }
      ],
      methods: [],
      position: { x: 100, y: 100 },
      width: 200,
      height: 100
    }
  ],
  relations: [
    {
      id: "ai-relation-123-0",
      type: "ONE_TO_MANY",
      source: "ai-class-123-0",
      target: "ai-class-123-1",
      sourceCardinality: "1",
      targetCardinality: "*"
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Función de Conversión

La función `convertApiResultToUMLDiagram()` realiza:

1. **Parseo de Atributos:**
   - Convierte `"+id: Long"` → `{ name: "id", type: "Long", isId: true }`
   - Maneja visibilidad: `+`, `-`, `#`, `~`
   - Detecta `isId` automáticamente

2. **Conversión de Relaciones:**
   - `from/to` → `source/target`
   - Normaliza tipos: `"association"` → `"ONE_TO_MANY"`
   - Calcula cardinalidades automáticamente

3. **Agregado de Metadata:**
   - Genera IDs únicos para clases y relaciones
   - Calcula posiciones libres en el canvas
   - Agrega dimensiones por defecto (width: 200, height: 100)

---

## 📝 Ejemplo Completo de Uso

### Componente React Completo

```typescript
import React, { useState } from 'react';
import { uploadImageFile } from '../services/aiImageService';
import { useDiagramStore } from '../store/useDiagramStore';

export const ImageUploader: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { setDiagram } = useDiagramStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // 1. Subir imagen al servidor
      const result = await uploadImageFile(
        file,
        { lang: 'es', useLLM: true },
        (pct) => setProgress(pct) // Callback de progreso
      );

      // 2. Verificar resultado
      if (result.meta?.error) {
        alert(`Error: ${result.meta.error}`);
        return;
      }

      // 3. Convertir resultado a UMLDiagram (usando función de conversión)
      const umlDiagram = convertApiResultToUMLDiagram(result);

      // 4. Actualizar store
      setDiagram(umlDiagram);

      // 5. Mostrar éxito
      alert(`✅ Diagrama generado: ${umlDiagram.classes.length} clases, ${umlDiagram.relations.length} relaciones`);

    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message || 'Error desconocido'}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && (
        <div>
          <progress value={progress} max={100} />
          <span>Subiendo... {progress}%</span>
        </div>
      )}
    </div>
  );
};
```

---

## ⚙️ Opciones de Configuración

### Opciones del Servicio (`uploadImageFile`)

```typescript
interface Options {
  lang?: string;      // Idioma para el análisis ('es', 'en', etc.)
  useLLM?: boolean;  // Usar IA (true) o fallback (false)
}
```

### Variables de Entorno (Backend)

```env
# API Key de Gemini
GEMINI_API_KEY=AIza...
GOOGLE_API_KEY=AIza...  # Alias

# Modelo (opcional)
GEMINI_MODEL=gemini-1.5-pro-latest

# Versión de API (opcional)
GEMINI_API_VERSION=v1beta

# URL completa (opcional, para casos especiales)
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent
```

---

## 🎨 Formato de Atributos Soportado

El parser de atributos soporta múltiples formatos:

### Formatos Válidos

1. **Con visibilidad:**
   - `"+id: Long"` → `{ name: "id", type: "Long", isId: true }`
   - `"-nombre: String"` → `{ name: "nombre", type: "String" }`
   - `"#atributo: int"` → `{ name: "atributo", type: "int" }`

2. **Sin visibilidad:**
   - `"id: Long"` → `{ name: "id", type: "Long" }`
   - `"nombre: String"` → `{ name: "nombre", type: "String" }`

3. **Ya como objeto:**
   - Si el atributo ya es un objeto `UMLAttribute`, se usa directamente

### Detección Automática

- **isId:** Se detecta si el nombre contiene "id" o si tiene visibilidad `+`
- **Tipo:** Se extrae después de los dos puntos (`:`)
- **Nombre:** Se extrae antes de los dos puntos, removiendo visibilidad

---

## 🔗 Tipos de Relaciones Soportados

El conversor normaliza los siguientes tipos:

| Tipo del API | Tipo Normalizado | Cardinalidades |
|--------------|------------------|----------------|
| `"association"` | `ONE_TO_MANY` | 1 → * |
| `"inheritance"` / `"extends"` | `INHERITANCE` | - |
| `"composition"` | `COMPOSITION` | - |
| `"aggregation"` | `AGGREGATION` | - |
| `"one_to_many"` | `ONE_TO_MANY` | 1 → * |
| `"many_to_one"` | `MANY_TO_ONE` | * → 1 |
| `"many_to_many"` | `MANY_TO_MANY` | * → * |
| `"one_to_one"` | `ONE_TO_ONE` | 1 → 1 |

---

## 🛠️ Manejo de Errores

### Códigos de Estado HTTP

- **200:** ✅ Éxito
- **400:** ❌ Imagen no proporcionada o formato inválido
- **401:** ❌ Error de autenticación (API key inválida)
- **502:** ❌ Proveedor de IA falló (Gemini no disponible)
- **504:** ❌ Timeout (imagen muy grande o servidor ocupado)
- **500:** ❌ Error interno del servidor

### Manejo en el Frontend

```typescript
try {
  const result = await uploadImageFile(file);
  // Procesar resultado
} catch (error: any) {
  if (error.status === 502) {
    alert('❌ El proveedor de IA falló. Intenta nuevamente.');
  } else if (error.status === 401) {
    alert('❌ Error de autenticación. Verifica la configuración.');
  } else if (error.status === 504) {
    alert('❌ Timeout. La imagen puede ser muy grande.');
  } else {
    alert(`❌ Error: ${error.message}`);
  }
}
```

---

## 📊 Ejemplo de Respuesta del API

### Respuesta Exitosa

```json
{
  "diagram": {
    "classes": [
      {
        "id": "c1",
        "name": "Usuario",
        "attributes": ["+id: Long", "-nombre: String", "+email: String"]
      },
      {
        "id": "c2",
        "name": "Pedido",
        "attributes": ["+id: Long", "-fecha: LocalDateTime", "-total: BigDecimal"]
      }
    ],
    "relations": [
      {
        "from": "c1",
        "to": "c2",
        "type": "ONE_TO_MANY"
      }
    ]
  },
  "meta": {
    "engine": "gemini",
    "model": "gemini-1.5-pro-latest",
    "elapsed": "2.5s",
    "imageSize": "245.67 KB",
    "language": "es",
    "useLLM": true
  }
}
```

### Respuesta con Error

```json
{
  "error": "AI provider failed",
  "details": "Gemini API returned no valid response",
  "diagram": {
    "classes": [],
    "relations": []
  },
  "meta": {
    "engine": "fallback",
    "error": "API key invalid",
    "statusCode": 401
  }
}
```

---

## ✅ Checklist de Integración

- [x] ✅ Servicio `aiImageService.ts` creado y tipado
- [x] ✅ Handler `handleUploadImage` en `useDiagramActions.ts`
- [x] ✅ Función de conversión `convertApiResultToUMLDiagram()`
- [x] ✅ Integración en `Sidebar.tsx`
- [x] ✅ Botón "Subir imagen" en `ActionButtons.tsx`
- [x] ✅ Manejo de errores específico
- [x] ✅ Validación de tipo de archivo
- [x] ✅ Mensajes de éxito/error al usuario
- [x] ✅ Limpieza del input después de procesar

---

## 🚀 Uso Rápido

1. **Abrir la aplicación**
2. **Hacer clic en "Subir imagen"** en el sidebar
3. **Seleccionar una imagen** de un diagrama UML
4. **Esperar el análisis** (puede tomar unos segundos)
5. **Ver el diagrama generado** automáticamente en el canvas

---

## 💡 Tips y Mejores Prácticas

1. **Calidad de Imagen:**
   - Usa imágenes de buena calidad (mínimo 800x600px)
   - Formato: PNG, JPEG, WebP
   - Tamaño máximo: 10MB

2. **Diagramas Claros:**
   - Asegúrate de que el texto sea legible
   - Evita diagramas muy complejos (>20 clases)
   - Usa diagramas con buena separación entre elementos

3. **Idioma:**
   - Especifica `lang: 'es'` para diagramas en español
   - El prompt de Gemini se adapta al idioma

4. **Manejo de Errores:**
   - Siempre maneja errores con try/catch
   - Muestra mensajes claros al usuario
   - Log errores para debugging

---

*Documento generado: Guía completa de uso del servicio de imagen a diagrama*
*Última actualización: Integración completa del servicio en el frontend*

