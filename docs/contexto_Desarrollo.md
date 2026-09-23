RESUMEN DE IMPLEMENTACIÓN - PROYECTO APLICACIÓN WEB COLABORATIVA UML

CICLO 1: FUNCIONALIDADES BÁSICAS

1. AUTENTICACIÓN Y USUARIOS
   - Login con Google OAuth
   - Gestión de perfiles (Anfitrión/Colaborador)
   - Sistema de roles y permisos básicos

2. GESTIÓN DE PROYECTOS
   - Crear, editar, eliminar proyectos
   - Configurar visibilidad de proyectos
   - Organización de proyectos por usuario

3. GESTIÓN DE DIAGRAMAS UML
   - Crear, editar, visualizar diagramas de clases
   - Operaciones drag-and-drop para elementos UML
   - Definir clases, atributos, métodos y relaciones básicas

4. COLABORACIÓN BÁSICA
   - Invitar colaboradores por email
   - Gestión de permisos por proyecto
   - Sistema de comentarios en diagramas

5. PERSISTENCIA
   - Base de datos PostgreSQL
   - Modelos: Usuario, Proyecto, Diagrama, Invitación, Comentario

TECNOLOGÍAS CICLO 1:
- Backend: - Node.js 20 + Express 4
- Frontend: React + Tailwind CSS
- Base de datos: PostgreSQL

CICLO 2: GENERACIÓN DE CÓDIGO Y IA

1. GENERADOR SPRING BOOT
   - Transformar diagramas UML a código Java
   - 4 capas: Entidades, Repositorios, Servicios, Controladores
   - Anotaciones JPA para persistencia
   - Endpoints REST automáticos

2. SISTEMA DE VERSIONADO
   - Historial de versiones de diagramas
   - Restaurar versiones anteriores
   - Snapshots automáticos

3. ASISTENCIA CON IA
   - Sugerir atributos para clases
   - Sugerir relaciones entre entidades
   - Generar pruebas unitarias automáticas

4. EXPORTACIÓN
   - Descargar código como proyecto Maven/Gradle
   - Documentación básica incluida

CICLO 3: FUNCIONALIDADES AVANZADAS

1. GENERADOR FLUTTER
   - Crear app móvil desde diagramas UML
   - Arquitectura en capas: Presentación, Negocio, Datos
   - Consumo automático de APIs REST generadas
   - UI adaptativa para iOS y Android

2. IA AVANZADA
   - Crear clases mediante prompts de texto
   - Modificar elementos existentes con lenguaje natural
   - Crear diagramas desde imágenes o bocetos
   - Refactorización inteligente

3. PERSONALIZACIÓN
   - Temas visuales para la aplicación Flutter
   - Esquemas de colores personalizables
   - Configuración de componentes UI

FUNCIONALIDADES CRÍTICAS POR IMPLEMENTAR:

1. COLABORACIÓN TIEMPO REAL (WebSockets)
2. GENERACIÓN DE CÓDIGO CON CALIDAD
3. INTEGRACIÓN CON APIs DE IA
4. GESTIÓN DE CONFLICTOS EN EDICIÓN SIMULTÁNEA
5. SISTEMA DE PRUEBAS AUTOMATIZADAS

ENTREGABLES PRINCIPALES:
- Aplicación web funcional (React + Express)
- Generador de código Spring Boot
- Editor UML colaborativo
- Sistema de autenticación y permisos
- Generador de aplicaciones Flutter (Ciclo 3)

NOTA: Priorizar implementación por ciclos, comenzando con funcionalidades básicas del Ciclo 1 antes de avanzar a características más complejas.



# Contexto de Desarrollo — Estándares de Codificación

Este documento define los estándares obligatorios que deben seguirse en todo el proyecto para mantener consistencia, claridad y calidad del código. Se aplican al backend (Node.js + Express con TypeScript), frontend (React) y cualquier integración futura.

## Principios generales
- Priorizar legibilidad, evitar duplicación y favorecer la modularidad.
- Validar código contra factores de calidad: correctitud, eficiencia, fiabilidad, mantenibilidad, portabilidad y seguridad.
- Usar control de versiones con commits claros y mensajes descriptivos.

## 1. Comentarios y documentación
-Documentación: usar comentarios JSDoc/TSDoc (/** ... */) con etiquetas @param, @returns, @throws, @example.
DTOs/entidades: anotar propiedades con @ApiProperty (from @nestjs/swagger) para generar docs OpenAPI y mantener JSDoc en clases/propiedades.
Validación: combinar class-validator/class-transformer con DTOs bien documentados.



## 2. Nombres (convención en español)
- Usar nombres en español para variables, funciones y clases (ej.: `ProyectoListaCrear`, `obtenerUsuario`, `validarEntrada`).
- Evitar abreviaturas ambiguas; si se usan, documentarlas.
- Clases en PascalCase, funciones y variables en camelCase o snake_case según el lenguaje (mantener coherencia por repo).

## 3. Frontend — estructura y navegación
- Usar React Router para la navegación y rutas claras.
- Componentes reutilizables y pequeños; cada componente debe tener una sola responsabilidad.
- Mantener estructura modular: components/, pages/, hooks/, store/, services/.
- Evitar componentes monolíticos; dividir en subcomponentes cuando la longitud o la complejidad aumente.

## 4. Backend (Express) y APIs
- El backend debe implementarse con Node.js (v20) + Express y TypeScript.
- Estructura modular basada en carpetas: controllers, services, repositories (o models), middlewares y routes. Separar responsabilidades (rutas → controladores → servicios → persistencia).
- Validación y transformación:
  - Usar DTOs/typing en TypeScript y validar entrada con class-validator + class-transformer mediante middleware, o con express-validator/Joi según preferencia del equipo.
  - Implementar middlewares para validación y transformación global cuando proceda.
- Convenciones de nombres en español: DTOs y clases en PascalCase (ej.: `UsuarioCrearDto`, `DiagramaServicio`), métodos y variables en camelCase (`obtenerDiagrama`, `validarEntrada`).
- Manejo de errores y excepciones:
  - Implementar un middleware centralizado de manejo de errores (error-handling middleware) y mapeo de errores a responses HTTP consistentes.
  - Registrar errores con un logger estructurado (p. ej. Winston o Pino).
- Persistencia:
  - Usar un ORM/QueryBuilder (por ejemplo Prisma o TypeORM) y definir estrategia de migrations y seeders (scripts en package.json para migraciones).
- Documentación de API:
  - Integrar Swagger con swagger-jsdoc + swagger-ui-express para generar la documentación OpenAPI.
- Seguridad y buenas prácticas:
  - No exponer credenciales en el repo; usar variables de entorno y/o vaults.
  - Proteger endpoints sensibles con middlewares de autenticación (passport.js, express-jwt) y autorización; aplicar rate-limiting, CORS, y medidas de hardening según necesidad.
- Pruebas:
  - Tests unitarios con Jest; tests e2e con SuperTest.
  - Añadir linters y checks en CI (ESLint, Prettier, type-check).

## 5. Modularidad y tamaño de archivos
- Ningún archivo debe exceder las 300 líneas de código. Si se supera, dividir en módulos o componentes adicionales.
- Mantener funciones pequeñas y con responsabilidad única.
- Exportar utilidades comunes a carpetas `utils/` o `helpers/`.

.


## 8. Seguridad y despliegue
- No subir credenciales a repositorio. Usar variables de entorno y vaults.
- Validar límites y proteger endpoints susceptibles a abuse (rate-limit, auth).
- Limpieza de recursos temporales y control de storage para artefactos generados.

---

Cumplir estos estándares garantiza código más mantenible, seguro y sencillo de revisar. Cualquier excepción debe justificarse en la PR correspondiente.