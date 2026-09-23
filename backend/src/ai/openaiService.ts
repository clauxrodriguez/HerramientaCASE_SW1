import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { callGemini } from './gemini/geminiClient';
import { inferAttributeType } from './applyUMLActions';

// Cargar variables de entorno antes de usar process.env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Verificar si la variable de entorno está cargada
console.log('OPENAI_API_KEY está cargada:', !!process.env.OPENAI_API_KEY);

// Validar que la API key existe (sin hacer crash al servidor si no existe)
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY no está configurada en .env. Se usará Gemini o el generador de prueba.');
}

// Inicializar el cliente OpenAI (con clave o dummy para evitar crash)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_fallback',
});

if (process.env.OPENAI_API_KEY) {
  console.log('✅ OpenAI client initialized successfully');
}

// Prompt de sistema para generación de diagramas completos
const DIAGRAM_SYSTEM_PROMPT = `Eres un experto en diseño UML y arquitectura de software. Tu tarea es convertir descripciones en lenguaje natural a diagramas UML completos con múltiples clases y sus relaciones.

INSTRUCCIONES CRÍTICAS:
- Responde ÚNICAMENTE en español
- Analiza la descripción del usuario y extrae todas las clases mencionadas
- Identifica las relaciones entre las clases usando los tipos apropiados
- Genera atributos apropiados para cada clase basándote en el contexto
- Incluye métodos comunes (guardar, buscar, eliminar) para cada clase
- Usa tipos Java apropiados (String, Long, Integer, Boolean, LocalDateTime, BigDecimal)
- Nombres en camelCase para atributos y métodos, PascalCase para clases
- Siempre incluye un campo 'id' como clave primaria en cada clase
- Para relaciones, genera IDs únicos y etiquetas descriptivas

TIPOS DE RELACIONES UML SOPORTADAS:
1. ONE_TO_ONE: Relación uno a uno (ej: Usuario tiene un Perfil)
2. ONE_TO_MANY: Relación uno a muchos (ej: Usuario tiene muchos Pedidos)
3. MANY_TO_ONE: Relación muchos a uno (ej: Pedidos pertenecen a un Usuario)
4. MANY_TO_MANY: Relación muchos a muchos (ej: Estudiantes tienen muchos Cursos, Cursos tienen muchos Estudiantes)
5. INHERITANCE: Herencia (ej: Empleado extiende de Persona, usa cuando una clase "es un tipo de" otra)
6. COMPOSITION: Composición (ej: Casa contiene Habitaciones, usa cuando una clase "contiene" otra y la parte no puede existir sin el todo)
7. AGGREGATION: Agregación (ej: Universidad tiene Estudiantes, usa cuando una clase "tiene" otra pero la parte puede existir independientemente)

CUANDO USAR CADA TIPO:
- INHERITANCE: Cuando una clase "es un tipo de" otra (relación is-a)
- COMPOSITION: Cuando una clase "contiene" otra y la parte no puede existir sin el todo (relación parte-todo fuerte)
- AGGREGATION: Cuando una clase "tiene" otra pero la parte puede existir independientemente (relación parte-todo débil)
- MANY_TO_MANY: Cuando múltiples instancias de una clase se relacionan con múltiples instancias de otra

FORMATO DE RESPUESTA:
Debes responder ÚNICAMENTE con un objeto JSON válido que siga exactamente esta estructura:
{
  "classes": [
    {
      "name": "NombreClase",
      "attributes": [
        {
          "name": "nombreAtributo",
          "type": "String|Long|Integer|Boolean|LocalDateTime|BigDecimal",
          "nullable": false,
          "unique": false,
          "isId": false
        }
      ],
      "methods": [
        {
          "name": "nombreMetodo",
          "returnType": "String|void|NombreClase",
          "parameters": [
            {
              "name": "nombreParametro",
              "type": "String"
            }
          ]
        }
      ]
    }
  ],
  "relations": [
    {
      "id": "relacion_1",
      "source": "ClaseOrigen",
      "target": "ClaseDestino",
      "type": "ONE_TO_ONE|ONE_TO_MANY|MANY_TO_ONE|MANY_TO_MANY|INHERITANCE|COMPOSITION|AGGREGATION",
      "sourceCardinality": "1|*|0..1|1..*",
      "targetCardinality": "1|*|0..1|1..*",
      "sourceLabel": "etiqueta origen (opcional)",
      "targetLabel": "etiqueta destino (opcional)",
      "mappedBy": "campoMapeado (opcional, para JPA)",
      "joinColumn": "columna_union (opcional, para JPA)",
      "label": "Etiqueta descriptiva (opcional)"
    }
  ]
}

CAMPOS OBLIGATORIOS PARA RELACIONES:
- id: Identificador único de la relación
- source: Nombre de la clase origen
- target: Nombre de la clase destino
- type: Tipo de relación (debe ser uno de los 7 tipos soportados)
- sourceCardinality: Cardinalidad en el origen (ej: "1", "*", "0..1", "1..*")
- targetCardinality: Cardinalidad en el destino (ej: "1", "*", "0..1", "1..*")

NO incluyas texto adicional, explicaciones o comentarios. Solo el JSON válido.`;

// Prompt de sistema para MODIFICAR un diagrama existente (contexto-aware)
const MODIFY_SYSTEM_PROMPT = `Eres un experto en diseño UML y arquitectura de software.
Tu tarea es LEER el diagrama UML actual y la instrucción del usuario, y devolver una lista de ACCIONES
para crear, actualizar, renombrar o eliminar elementos existentes sin duplicarlos innecesariamente.

REQUISITOS CLAVE Y REGLAS DE PRIORIZACIÓN CRÍTICAS:
1. REVISA SIEMPRE las clases existentes en el diagrama actual.
2. Si el usuario pide "relacionar/conectar X e Y" (o "añadir una relación entre X e Y") y las clases X e Y YA EXISTEN en el diagrama actual, DEBES devolver ÚNICAMENTE una acción CREATE_RELATION entre esas dos clases. ¡NO CREES NUEVAS CLASES NI DUPLICADOS!
3. Si el usuario pide "agregar/añadir un atributo Z a la clase X" y la clase X YA EXISTE, devuelve ÚNICAMENTE la acción ADD_ATTRIBUTE para la clase X. ¡NO CREES NUEVAS CLASES!
4. Crea una clase nueva con CREATE_CLASS únicamente si la clase mencionada NO EXISTE en el diagrama actual.
5. Responde ÚNICAMENTE en español y mantén convenciones: PascalCase para clases, camelCase para atributos/métodos.

TIPOS DE RELACIONES UML SOPORTADAS:
1. ONE_TO_ONE: Relación uno a uno (ej: Usuario tiene un Perfil)
2. ONE_TO_MANY: Relación uno a muchos (ej: Usuario tiene muchos Pedidos)
3. MANY_TO_ONE: Relación muchos a uno (ej: Pedidos pertenecen a un Usuario)
4. MANY_TO_MANY: Relación muchos a muchos (ej: Estudiantes tienen muchos Cursos, Cursos tienen muchos Estudiantes)
5. INHERITANCE: Herencia (ej: Empleado extiende de Persona, usa "extiende", "hereda", "es un")
6. COMPOSITION: Composición (ej: Casa contiene Habitaciones, usa "contiene", "compone", "parte de")
7. AGGREGATION: Agregación (ej: Universidad tiene Estudiantes, usa "tiene", "agrega", "incluye")

FORMATO DE RESPUESTA (JSON válido):
{
  "actions": [
    {
      "type": "CREATE_CLASS|UPDATE_CLASS|DELETE_CLASS|RENAME_CLASS|ADD_ATTRIBUTE|UPDATE_ATTRIBUTE|DELETE_ATTRIBUTE|ADD_METHOD|UPDATE_METHOD|DELETE_METHOD|CREATE_RELATION|UPDATE_RELATION|DELETE_RELATION",
      "target": {
        "className": "NombreClase",
        "newClassName": "NuevoNombreClase",
        "relationId": "relacion_1",
        "sourceClassName": "ClaseOrigen",
        "targetClassName": "ClaseDestino",
        "attributeName": "nombreAtributo",
        "newAttributeName": "nuevoNombreAtributo",
        "methodName": "nombreMetodo",
        "newMethodName": "nuevoNombreMetodo"
      },
      "payload": {
        "type": "ONE_TO_ONE|ONE_TO_MANY|MANY_TO_ONE|MANY_TO_MANY|INHERITANCE|COMPOSITION|AGGREGATION",
        "source": "ClaseOrigen",
        "target": "ClaseDestino",
        "sourceCardinality": "1|*|0..1|1..*",
        "targetCardinality": "1|*|0..1|1..*",
        "mappedBy": "nombreCampo (opcional, para JPA)",
        "joinColumn": "nombre_columna (opcional, para JPA)",
        "label": "Etiqueta descriptiva (opcional)"
      },
      "reason": "Explicación breve de por qué se toma esta acción"
    }
  ]
}

NO incluyas texto adicional ni comentarios fuera del JSON.`;

export interface AISuggestion {
  type: 'attribute' | 'method' | 'relation' | 'normalization' | 'naming';
  title: string;
  description: string;
  suggestion: any;
  priority: 'low' | 'medium' | 'high';
}

export interface GeneratedUMLClass {
  name: string;
  attributes: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    unique?: boolean;
    isId?: boolean;
  }>;
  methods: Array<{
    name: string;
    returnType: string;
    parameters: Array<{ name: string; type: string }>;
  }>;
  relations: Array<{
    type: string;
    target: string;
    mappedBy?: string;
    joinColumn?: string;
  }>;
}

export interface UMLDiagramResponse {
  classes: Array<{
    name: string;
    attributes: Array<{
      name: string;
      type: string;
      nullable?: boolean;
      unique?: boolean;
      isId?: boolean;
    }>;
    methods: Array<{
      name: string;
      returnType: string;
      parameters: Array<{ name: string; type: string }>;
    }>;
  }>;
  relations: Array<{
    id: string;
    source: string;
    target: string;
    type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY' | 'INHERITANCE' | 'COMPOSITION' | 'AGGREGATION';
    sourceCardinality?: string;
    targetCardinality?: string;
    sourceLabel?: string;
    targetLabel?: string;
    mappedBy?: string;
    joinColumn?: string;
    label?: string;
  }>;
}

// Acciones para modificar un diagrama existente de forma consciente del contexto
export type UMLActionType =
  | 'CREATE_CLASS'
  | 'UPDATE_CLASS'
  | 'DELETE_CLASS'
  | 'RENAME_CLASS'
  | 'ADD_ATTRIBUTE'
  | 'UPDATE_ATTRIBUTE'
  | 'DELETE_ATTRIBUTE'
  | 'ADD_METHOD'
  | 'UPDATE_METHOD'
  | 'DELETE_METHOD'
  | 'CREATE_RELATION'
  | 'UPDATE_RELATION'
  | 'DELETE_RELATION';

export interface UMLActionTarget {
  className?: string;
  newClassName?: string; // para RENAME_CLASS
  relationId?: string;
  sourceClassName?: string;
  targetClassName?: string;
  attributeName?: string;
  newAttributeName?: string; // para renombrar atributo
  methodName?: string;
  newMethodName?: string; // para renombrar método
}

export interface UMLAction {
  type: UMLActionType;
  target?: UMLActionTarget;
  // payload contendrá el objeto completo que se debe crear/actualizar
  payload?: any;
  // razón opcional para trazabilidad
  reason?: string;
}

export interface UMLActionResponse {
  actions: UMLAction[];
}

export async function getAISuggestions(umlData: any): Promise<AISuggestion[]> {
  try {
    const prompt = `
Analiza el siguiente diagrama UML y proporciona sugerencias de mejora:

Datos UML:
${JSON.stringify(umlData, null, 2)}

Por favor proporciona sugerencias en las siguientes áreas:
1. Atributos faltantes (como id, timestamps, etc.)
2. Convenciones de nomenclatura (camelCase para atributos, PascalCase para clases)
3. Relaciones faltantes
4. Oportunidades de normalización
5. Métodos faltantes

INSTRUCCIONES CRÍTICAS:
- Responde ÚNICAMENTE en español
- Los títulos deben ser frases completas en español
- Las descripciones deben explicar claramente el problema y la solución
- Usa el formato exacto: "Faltan timestamps: La clase 'NombreClase' debería incluir los campos createdAt y updatedAt"
- Para relaciones: "Recomendación: La clase 'ClaseA' debería tener una relación con la clase 'ClaseB'"
- Para atributos: "Falta clave primaria: La clase 'NombreClase' debería tener un campo id como clave primaria"
- Para métodos: "Métodos faltantes: La clase 'NombreClase' debería incluir métodos para [funcionalidad específica]"

Devuelve tu respuesta como un array JSON de sugerencias con esta estructura:
[
  {
    "type": "attribute|method|relation|normalization|naming",
    "title": "Título descriptivo en español",
    "description": "Descripción detallada del problema y solución en español",
    "suggestion": "El objeto de sugerencia real",
    "priority": "low|medium|high"
  }
]
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Eres un experto en diseño UML. Analiza diagramas UML y proporciona sugerencias constructivas de mejora. OBLIGATORIO: Responde ÚNICAMENTE en español. Todos los títulos, descripciones y sugerencias deben estar en español. Usa frases completas y descriptivas. Responde con JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(response);
  } catch (error) {
    console.error('Error getting AI suggestions:', error);
    return getMockSuggestions(umlData);
  }
}

export async function generateFromText(text: string): Promise<GeneratedUMLClass> {
  try {
    const prompt = `
Convierte la siguiente descripción en lenguaje natural a una definición de clase UML:

Descripción: "${text}"

IMPORTANTE: Responde SIEMPRE en español. Todos los nombres de clases, atributos y métodos deben estar en español.

Devuelve un objeto JSON con esta estructura:
{
  "name": "NombreClase",
  "attributes": [
    {
      "name": "nombreAtributo",
      "type": "String|Long|Integer|Boolean|LocalDateTime|BigDecimal",
      "nullable": false,
      "unique": false,
      "isId": false
    }
  ],
  "methods": [
    {
      "name": "nombreMetodo",
      "returnType": "String|void|NombreClase",
      "parameters": [
        {
          "name": "nombreParametro",
          "type": "String"
        }
      ]
    }
  ],
  "relations": [
    {
      "type": "ONE_TO_ONE|ONE_TO_MANY|MANY_TO_ONE|MANY_TO_MANY",
      "target": "ClaseRelacionada",
      "mappedBy": "nombreCampo",
      "joinColumn": "nombre_columna"
    }
  ]
}

Pautas:
- Usa tipos Java apropiados
- Incluye un campo id con isId: true para la clave primaria
- Usa camelCase para atributos y métodos
- Usa PascalCase para nombres de clases
- Incluye métodos comunes como guardar(), buscarPorId(), etc.
- Agrega relaciones apropiadas si se mencionan
- NOMBRES EN ESPAÑOL: Si la descripción está en español, usa nombres en español
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Eres un experto en diseño UML. Convierte descripciones en lenguaje natural a definiciones de clases UML apropiadas. SIEMPRE responde en español y con JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(response);
  } catch (error) {
    console.error('Error generating from text:', error);
    return getMockGeneratedClass(text);
  }
}

export async function generateDiagramFromText(text: string): Promise<UMLDiagramResponse> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: DIAGRAM_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const parsedResponse = JSON.parse(response);
    
    // Validar que la respuesta tenga la estructura esperada
    if (!parsedResponse.classes || !Array.isArray(parsedResponse.classes)) {
      throw new Error('Invalid response structure: missing classes array');
    }
    
    if (!parsedResponse.relations || !Array.isArray(parsedResponse.relations)) {
      parsedResponse.relations = [];
    }

    return parsedResponse as UMLDiagramResponse;
  } catch (error) {
    console.error('Error generating diagram from text with OpenAI:', error);
    
    // Fallback a Gemini API gratuita
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      console.log('🔄 OpenAI no disponible o sin saldo. Usando Gemini API gratuita para generar el diagrama...');
      try {
        const geminiRes = await callGemini({
          prompt: `${DIAGRAM_SYSTEM_PROMPT}\n\nINSTRUCCIÓN DEL USUARIO PARA GENERAR DIAGRAMA:\n${text}\n\nIMPORTANTE: Responde ÚNICAMENTE en formato JSON válido.`
        });
        if (geminiRes.normalized && geminiRes.normalized.classes && Array.isArray(geminiRes.normalized.classes)) {
          if (!geminiRes.normalized.relations) geminiRes.normalized.relations = [];
          console.log('✅ Diagrama generado exitosamente con Gemini API');
          return geminiRes.normalized as UMLDiagramResponse;
        }
      } catch (geminiErr) {
        console.error('Error en fallback con Gemini:', geminiErr);
      }
    }
    
    return getMockDiagramResponse(text);
  }
}

export async function modifyDiagramFromText(currentDiagram: any, text: string): Promise<UMLActionResponse> {
  try {
    const userPrompt = `DIAGRAMA ACTUAL (JSON):\n${JSON.stringify(currentDiagram, null, 2)}\n\nINSTRUCCIÓN DEL USUARIO:\n${text}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: MODIFY_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(response);
    if (!parsed.actions || !Array.isArray(parsed.actions)) {
      throw new Error('Invalid response structure: missing actions array');
    }

    return parsed as UMLActionResponse;
  } catch (error) {
    console.error('Error modifying diagram from text with OpenAI:', error);
    
    // Fallback a Gemini API gratuita
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      console.log('🔄 OpenAI no disponible o sin saldo. Usando Gemini API gratuita para modificar el diagrama...');
      try {
        const userPrompt = `DIAGRAMA ACTUAL (JSON):\n${JSON.stringify(currentDiagram, null, 2)}\n\nINSTRUCCIÓN DEL USUARIO:\n${text}`;
        const geminiRes = await callGemini({
          prompt: `${MODIFY_SYSTEM_PROMPT}\n\n${userPrompt}\n\nIMPORTANTE: Responde ÚNICAMENTE en formato JSON válido.`
        });
        if (geminiRes.normalized && geminiRes.normalized.actions && Array.isArray(geminiRes.normalized.actions)) {
          console.log('✅ Acciones generadas exitosamente con Gemini API');
          return geminiRes.normalized as UMLActionResponse;
        }
      } catch (geminiErr) {
        console.error('Error en fallback de modificación con Gemini:', geminiErr);
      }
    }
    
    return getMockModificationActions(currentDiagram, text);
  }
}

function getMockSuggestions(umlData: any): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  // Check for missing ID fields
  umlData.classes?.forEach((cls: any) => {
    const hasId = cls.attributes?.some((attr: any) => attr.isId);
      if (!hasId) {
      suggestions.push({
        type: 'attribute',
        title: 'Missing Primary Key',
        description: `La clase "${cls.name}" debería tener un campo clave primaria (id)`,
        suggestion: {
          name: 'id',
          type: 'Long',
          isId: true
        },
        priority: 'high'
      });
    }
  });

  // Check for missing timestamps
  umlData.classes?.forEach((cls: any) => {
    const hasTimestamps = cls.attributes?.some((attr: any) => 
      attr.name === 'createdAt' || attr.name === 'updatedAt'
    );
    if (!hasTimestamps) {
      suggestions.push({
        type: 'attribute',
        title: 'Missing Timestamps',
        description: `La clase "${cls.name}" podría beneficiarse de los campos createdAt y updatedAt`,
        suggestion: [
          { name: 'createdAt', type: 'LocalDateTime', nullable: false },
          { name: 'updatedAt', type: 'LocalDateTime', nullable: false }
        ],
        priority: 'medium'
      });
    }
  });

  // Check naming conventions
  umlData.classes?.forEach((cls: any) => {
    cls.attributes?.forEach((attr: any) => {
      if (attr.name !== attr.name.charAt(0).toLowerCase() + attr.name.slice(1)) {
        suggestions.push({
          type: 'naming',
          title: 'Naming Convention',
          description: `El atributo "${attr.name}" debería estar en camelCase`,
          suggestion: {
            oldName: attr.name,
            newName: attr.name.charAt(0).toLowerCase() + attr.name.slice(1)
          },
          priority: 'low'
        });
      }
    });
  });

  return suggestions;
}

function getMockGeneratedClass(text: string): GeneratedUMLClass {
  // Simple mock implementation
  const words = text.toLowerCase().split(' ');
  const className = words.find(word => word.includes('class') || word.includes('entity')) || 'GeneratedClass';
  
  return {
    name: className.charAt(0).toUpperCase() + className.slice(1),
    attributes: [
      { name: 'id', type: 'Long', isId: true },
      { name: 'name', type: 'String', nullable: false },
      { name: 'createdAt', type: 'LocalDateTime', nullable: false },
      { name: 'updatedAt', type: 'LocalDateTime', nullable: false }
    ],
    methods: [
      { name: 'save', returnType: 'void', parameters: [] },
      { name: 'findById', returnType: className, parameters: [{ name: 'id', type: 'Long' }] },
      { name: 'delete', returnType: 'void', parameters: [] }
    ],
    relations: []
  };
}

function getMockDiagramResponse(text: string): UMLDiagramResponse {
  // Intentar parsear patrones como "Mascota (id, nombre, ...)"
  const classMatches = Array.from(text.matchAll(/([A-Z][a-zA-Z0-9]+)\s*\(([^)]+)\)/g));
  
  if (classMatches.length > 0) {
    const mockClasses = classMatches.map((match) => {
      const className = match[1];
      const rawAttrs = match[2].split(',').map(a => a.trim().split(':')[0].split(' ')[0]).filter(Boolean);
      
      const attributes = rawAttrs.map(attrName => {
        const isId = attrName.toLowerCase() === 'id';
        let type = 'String';
        if (isId) type = 'Long';
        else if (attrName.toLowerCase().includes('fecha')) type = 'LocalDateTime';
        else if (attrName.toLowerCase().includes('costo') || attrName.toLowerCase().includes('precio')) type = 'BigDecimal';
        else if (attrName.toLowerCase().includes('edad')) type = 'Integer';

        return {
          name: attrName,
          type,
          isId,
          nullable: !isId
        };
      });

      return {
        name: className,
        attributes,
        methods: [
          { name: 'guardar', returnType: 'void', parameters: [] },
          { name: 'buscarPorId', returnType: className, parameters: [{ name: 'id', type: 'Long' }] }
        ]
      };
    });

    const relations = [];
    for (let i = 0; i < mockClasses.length - 1; i++) {
      relations.push({
        id: `relacion_${i + 1}`,
        source: mockClasses[i].name,
        target: mockClasses[i + 1].name,
        type: 'ONE_TO_MANY' as const,
        sourceCardinality: '1',
        targetCardinality: '*'
      });
    }

    return { classes: mockClasses, relations };
  }

  // Diccionario de sinónimos y términos canónicos en español para evitar duplicados como "Cliente" + "Client"
  const synonymMap: Record<string, string> = {
    'usuario': 'Usuario',
    'user': 'Usuario',
    'cliente': 'Cliente',
    'client': 'Cliente',
    'producto': 'Producto',
    'product': 'Producto',
    'articulo': 'Articulo',
    'article': 'Articulo',
    'pedido': 'Pedido',
    'order': 'Pedido',
    'mascota': 'Mascota',
    'propietario': 'Propietario',
    'veterinario': 'Veterinario',
    'cita': 'CitaMedica',
    'citamedica': 'CitaMedica',
    'factura': 'Factura',
    'invoice': 'Factura',
    'detalle': 'DetalleFactura'
  };

  const detectedSet = new Set<string>();
  const words = text.toLowerCase().split(/\W+/);
  for (const w of words) {
    if (synonymMap[w]) {
      detectedSet.add(synonymMap[w]);
    }
  }

  const classes = detectedSet.size > 0 ? Array.from(detectedSet) : ['Usuario', 'Articulo'];

  const mockClasses = classes.map((className) => ({
    name: className,
    attributes: [
      { name: 'id', type: 'Long', isId: true },
      { name: 'nombre', type: 'String', nullable: false },
      { name: 'createdAt', type: 'LocalDateTime', nullable: false },
      { name: 'updatedAt', type: 'LocalDateTime', nullable: false }
    ],
    methods: [
      { name: 'guardar', returnType: 'void', parameters: [] },
      { name: 'buscarPorId', returnType: className, parameters: [{ name: 'id', type: 'Long' }] },
      { name: 'eliminar', returnType: 'void', parameters: [] }
    ]
  }));

  const mockRelations = classes.length > 1 ? [
    {
      id: 'relacion_1',
      source: classes[0],
      target: classes[1],
      type: 'ONE_TO_MANY' as const,
      sourceLabel: 'tiene',
      targetLabel: 'pertenece',
      mappedBy: classes[0].toLowerCase(),
      joinColumn: `${classes[0].toLowerCase()}_id`
    }
  ] : [];

  return {
    classes: mockClasses,
    relations: mockRelations
  };
}

function getMockModificationActions(currentDiagram: any, text: string): UMLActionResponse {
  const actions: UMLAction[] = [];
  const lower = (text || '').toLowerCase().trim();
  const classesInDiagram: any[] = currentDiagram?.classes || [];

  // 1. RECONOCER INTENTO DE CREAR RELACIÓN ENTRE CLASES EXISTENTES
  const isRelationIntent = lower.includes('relacion') || lower.includes('relación') ||
                           lower.includes('conecta') || lower.includes('conectar') ||
                           lower.includes('vincula') || lower.includes('vincular') ||
                           lower.includes('asocia') || lower.includes('asociar') ||
                           lower.includes('entre');

  // Buscar qué clases existentes en el diagrama son mencionadas en el texto
  const mentionedClasses = classesInDiagram.filter((c: any) => {
    const cName = (c.name || '').toLowerCase();
    return cName && lower.includes(cName);
  });

  if (mentionedClasses.length >= 2 || (isRelationIntent && mentionedClasses.length >= 1)) {
    let sourceClass = mentionedClasses[0]?.name;
    let targetClass = mentionedClasses[1]?.name;

    if (!targetClass && classesInDiagram.length >= 2) {
      const other = classesInDiagram.find((c: any) => c.name.toLowerCase() !== sourceClass?.toLowerCase());
      if (other) targetClass = other.name;
    }

    if (sourceClass && targetClass) {
      let relType = 'ONE_TO_MANY';
      if (lower.includes('muchos a muchos') || lower.includes('many to many')) relType = 'MANY_TO_MANY';
      else if (lower.includes('uno a uno') || lower.includes('one to one')) relType = 'ONE_TO_ONE';
      else if (lower.includes('composicion') || lower.includes('composición')) relType = 'COMPOSITION';
      else if (lower.includes('agregacion') || lower.includes('agregación')) relType = 'AGGREGATION';
      else if (lower.includes('herencia') || lower.includes('extiende')) relType = 'INHERITANCE';

      actions.push({
        type: 'CREATE_RELATION',
        target: { sourceClassName: sourceClass, targetClassName: targetClass },
        payload: {
          source: sourceClass,
          target: targetClass,
          type: relType,
          sourceCardinality: relType === 'MANY_TO_MANY' ? '*' : '1',
          targetCardinality: '*'
        },
        reason: `Relación ${relType} creada entre ${sourceClass} y ${targetClass}`
      });
      return { actions };
    }
  }

  // 2. HEURÍSTICA DE AÑADIR ATRIBUTO A CLASE EXISTENTE
  const addAttrMatch = lower.match(/(añade|agrega|agregar|add|crea|crear)\s+(el\s+atributo\s+|el\s+campo\s+|un\s+atributo\s+|un\s+campo\s+)?(\w+)\s+(a|en)\s+(la\s+clase\s+|la\s+tabla\s+)?(\w+)/);
  if (addAttrMatch) {
    const attribute = addAttrMatch[3];
    const classNameRaw = addAttrMatch[6];
    const matchedClass = classesInDiagram.find((c: any) => c.name.toLowerCase() === classNameRaw.toLowerCase());
    if (matchedClass) {
      actions.push({
        type: 'ADD_ATTRIBUTE',
        target: { className: matchedClass.name },
        payload: { name: attribute, type: inferAttributeType(attribute), nullable: false }
      });
      return { actions };
    }
  }

  const isAttrIntent = lower.includes('atributo') || lower.includes('campo');
  if (isAttrIntent) {
    const matchedClass = classesInDiagram.find((c: any) => lower.includes(c.name.toLowerCase()));
    if (matchedClass) {
      const words = lower.split(/\s+/);
      const stopWords = ['añade', 'agrega', 'crea', 'un', 'el', 'atributo', 'campo', 'a', 'la', 'clase', 'tabla', matchedClass.name.toLowerCase()];
      const potentialAttr = words.find(w => !stopWords.includes(w) && w.length > 2);
      if (potentialAttr) {
        actions.push({
          type: 'ADD_ATTRIBUTE',
          target: { className: matchedClass.name },
          payload: { name: potentialAttr, type: inferAttributeType(potentialAttr), nullable: false }
        });
        return { actions };
      }
    }
  }

  // 3. HEURÍSTICA: "renombra la clase X a Y"
  const renameMatch = lower.match(/renombra(r)?\s+la\s+clase\s+(\w+)\s+a\s+(\w+)/);
  if (renameMatch) {
    const [, , fromRaw, toRaw] = renameMatch;
    const from = fromRaw.charAt(0).toUpperCase() + fromRaw.slice(1);
    const to = toRaw.charAt(0).toUpperCase() + toRaw.slice(1);
    actions.push({ type: 'RENAME_CLASS', target: { className: from, newClassName: to } });
    return { actions };
  }

  // 4. HEURÍSTICA DE CREAR NUEVA CLASE (Evitando palabras reservadas de relaciones)
  const reservedWords = ['relacion', 'relación', 'conexion', 'conexión', 'asociacion', 'asociación', 'atributo', 'campo', 'tabla', 'clase'];
  const createClassMatch = lower.match(/(agrega|añade|crea|inserta|agregar|añadir|crear)\s+(una\s+)?(tabla\s+|clase\s+)?(\w+)/);
  if (createClassMatch) {
    let classNameRaw = createClassMatch[4];
    if (['tabla', 'clase', 'una', 'un'].includes(classNameRaw.toLowerCase())) {
      const parts = lower.split(/\s+/);
      const idx = parts.indexOf(classNameRaw.toLowerCase());
      if (idx !== -1 && parts[idx + 1]) classNameRaw = parts[idx + 1];
    }

    if (!reservedWords.includes(classNameRaw.toLowerCase())) {
      const className = classNameRaw.charAt(0).toUpperCase() + classNameRaw.slice(1);
      const exists = classesInDiagram.some((c: any) => c.name.toLowerCase() === className.toLowerCase());

      if (!exists) {
        actions.push({
          type: 'CREATE_CLASS',
          target: { className },
          payload: {
            name: className,
            attributes: [
              { name: 'id', type: 'Long', isId: true },
              { name: 'nombre', type: 'String', nullable: false },
              { name: 'estado', type: 'String', nullable: false }
            ],
            methods: [
              { name: 'guardar', returnType: 'void', parameters: [] },
              { name: 'buscarPorId', returnType: className, parameters: [{ name: 'id', type: 'Long' }] }
            ]
          }
        });

        if (classesInDiagram.length > 0) {
          const firstClass = classesInDiagram[0].name;
          actions.push({
            type: 'CREATE_RELATION',
            target: { sourceClassName: firstClass, targetClassName: className },
            payload: {
              source: firstClass,
              target: className,
              type: 'ONE_TO_MANY',
              sourceCardinality: '1',
              targetCardinality: '*'
            }
          });
        }

        return { actions };
      }
    }
  }

  // 5. Fallback por nombre suelto
  const words = lower.split(/\s+/);
  const potentialName = words.find(w => !['agrega', 'añade', 'crea', 'tabla', 'clase', 'una', 'un', 'de', 'la', 'el', 'con', 'y', ...reservedWords].includes(w));
  if (potentialName) {
    const className = potentialName.charAt(0).toUpperCase() + potentialName.slice(1);
    const exists = classesInDiagram.some((c: any) => c.name.toLowerCase() === className.toLowerCase());
    if (!exists) {
      actions.push({
        type: 'CREATE_CLASS',
        target: { className },
        payload: {
          name: className,
          attributes: [
            { name: 'id', type: 'Long', isId: true },
            { name: 'nombre', type: 'String', nullable: false },
            { name: 'estado', type: 'String', nullable: false }
          ],
          methods: [
            { name: 'guardar', returnType: 'void', parameters: [] },
            { name: 'buscarPorId', returnType: className, parameters: [{ name: 'id', type: 'Long' }] }
          ]
        }
      });
      return { actions };
    }
  }

  return { actions };
}

