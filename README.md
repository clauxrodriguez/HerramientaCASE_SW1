# UML Diagram Tool - Generador de Código Spring Boot

Una aplicación web colaborativa para crear diagramas UML de clases y generar automáticamente proyectos Spring Boot completos.

## 🚀 Características

- **Editor UML Visual**: Lienzo interactivo con react-konva para crear y editar diagramas de clases
- **Colaboración en Tiempo Real**: Múltiples usuarios pueden trabajar simultáneamente usando socket.io
- **Generación de Código**: Convierte diagramas UML a proyectos Spring Boot completos
- **IA Integrada**: Sugerencias automáticas y generación de clases desde texto natural
- **Exportación**: Descarga proyectos Spring Boot como archivos ZIP

## 🛠️ Stack Tecnológico

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- react-konva/konva (lienzo interactivo)
- Zustand (gestión de estado)
- socket.io-client (colaboración en tiempo real)

### Backend
- Node.js 20 + Express 4
- socket.io 4 (colaboración)
- PostgreSQL 15 (base de datos)
- OpenAI API (IA)

### Generado
- Spring Boot 3 + Java 17
- Maven (gestión de dependencias)
- JPA + PostgreSQL
- MapStruct (mapeo de objetos)

## 📁 Estructura del Proyecto

```
root/
├── frontend/              # React + TypeScript + Vite
├── server/                # Node.js + Express + socket.io
│   ├── src/
│   │   ├── collaboration/ # eventos socket.io
│   │   ├── generator/     # generador Spring Boot
│   │   ├── ai/           # integración OpenAI
│   │   └── db/           # modelos PostgreSQL
│   └── .env.example
├── generated/             # proyectos Spring Boot exportados
├── db/
│   └── docker-compose.yml # PostgreSQL + pgAdmin
└── README.md
```

## 🚀 Instalación y Uso

### Prerrequisitos
- Node.js 20+
- Docker y Docker Compose
- Cuenta de OpenAI (para funcionalidades de IA)
- Ngrok (para despliegue público)

### Inicio Rápido

#### Opción 1: Script Automático (Recomendado)

**Linux/macOS:**
```bash
./start.sh
```

**Windows:**
```cmd
start.bat
```

#### Opción 2: Instalación Manual

**1. Clonar y Configurar**
```bash
# Clonar el repositorio
git clone <repository-url>
cd uml-diagram-tool

# Configurar variables de entorno
cp server/env.example server/.env
# Editar server/.env y agregar tu OPENAI_API_KEY
```

**2. Base de Datos**
```bash
# Iniciar PostgreSQL
docker compose up -d

# Verificar que esté corriendo
docker compose ps
```

**3. Backend**
```bash
cd server
npm install
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

**4. Frontend**
```bash
cd frontend
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Configuración de OpenAI (Opcional)

Para usar las funcionalidades de IA:

1. Obtén una API key de OpenAI en [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Edita `server/.env` y agrega tu clave:
   ```
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

Sin la API key, las funcionalidades de IA usarán respuestas mock.

## 🌐 Despliegue con Ngrok (Un Solo Túnel)

Para exponer tu aplicación públicamente usando un solo túnel de Ngrok:

### 1. Compilar el Frontend
```bash
cd frontend
npm run build
```

### 2. Iniciar el Backend
```bash
cd server
npm run dev
```

### 3. Exponer con Ngrok
```bash
ngrok http 3001
```

### 4. Acceder a la Aplicación
- **URL de Ngrok**: Usa la URL HTTPS que te proporciona Ngrok (ej: `https://abc123.ngrok.io`)
- **Frontend**: Accede directamente a la URL de Ngrok
- **API**: Los endpoints están disponibles en `/api/...`
- **WebSocket**: Socket.io funciona automáticamente en la misma URL

### Script de Build Completo
```bash
# Desde la raíz del proyecto
cd server
npm run build:all  # Compila frontend y backend
npm start          # Inicia en modo producción
```

### Variables de Entorno para Producción
El frontend automáticamente detecta que está en producción y usa la misma URL del servidor para las llamadas API.

## 📊 Uso de la Aplicación

### Crear un Diagrama UML

1. **Agregar Clases**: Haz clic en el lienzo para crear una nueva clase
2. **Editar Propiedades**: Selecciona una clase y usa el panel lateral para:
   - Cambiar nombre
   - Agregar atributos (nombre, tipo, nullable, unique, isId)
   - Agregar métodos
3. **Crear Relaciones**: Arrastra desde una clase a otra para crear relaciones
4. **Colaborar**: Comparte el enlace con otros usuarios para colaboración en tiempo real

### Generar Código Spring Boot

1. **Exportar Diagrama**: Usa el botón "Exportar UML JSON" para descargar el diagrama
2. **Generar Backend**: Haz clic en "Generar Backend" para crear el proyecto Spring Boot
3. **Descargar ZIP**: El proyecto se descargará automáticamente como archivo ZIP

### Usar IA

1. **Sugerencias**: Haz clic en "Sugerencias IA" para obtener mejoras automáticas
2. **Generar desde Texto**: Usa "Crear desde Texto" para convertir descripción natural a clases UML

## 🔧 API Endpoints

### REST API

- `GET /health` - Estado del servidor
- `POST /api/generator/spring` - Generar proyecto Spring Boot
- `POST /api/ai/suggest` - Obtener sugerencias de IA
- `POST /api/ai/from-text` - Generar UML desde texto

### WebSocket Events

- `diagram:join` - Unirse a un diagrama
- `diagram:update` - Actualizar diagrama
- `diagram:lock` - Bloquear elemento
- `diagram:unlock` - Desbloquear elemento
- `diagram:leave` - Salir del diagrama

## 📝 Formato UML JSON

```json
{
  "package": "com.app",
  "classes": [
    {
      "name": "Usuario",
      "attributes": [
        {"name": "id", "type": "Long", "isId": true},
        {"name": "nombre", "type": "String", "nullable": false},
        {"name": "email", "type": "String", "unique": true}
      ],
      "methods": [],
      "relations": [
        {"type": "ONE_TO_MANY", "target": "Pedido", "mappedBy": "usuario"}
      ]
    }
  ]
}
```

## 🏗️ Proyecto Spring Boot Generado

El generador crea un proyecto completo con:

- **Entidades JPA** con anotaciones apropiadas
- **DTOs** para transferencia de datos
- **Repositorios** extendiendo JpaRepository
- **Servicios** con interfaces e implementaciones
- **Controladores REST** con endpoints CRUD
- **Mappers** usando MapStruct
- **Configuración** de base de datos PostgreSQL
- **Colección Postman** para testing

### Ejecutar Proyecto Generado

```bash
# Extraer el ZIP descargado
unzip generated-project.zip
cd generated-project

# Instalar dependencias
mvn clean install

# Ejecutar aplicación
mvn spring-boot:run
```

### Ejemplo de UML JSON

Puedes usar el archivo `examples/sample-uml.json` como referencia:

```json
{
  "package": "com.ecommerce",
  "classes": [
    {
      "name": "User",
      "attributes": [
        {"name": "id", "type": "Long", "isId": true},
        {"name": "username", "type": "String", "nullable": false},
        {"name": "email", "type": "String", "unique": true}
      ],
      "methods": [
        {"name": "save", "returnType": "void", "parameters": []}
      ],
      "relations": [
        {"type": "ONE_TO_MANY", "target": "Order", "mappedBy": "user"}
      ]
    }
  ]
}
```

## 🐳 Docker

### Base de Datos

```bash
cd db
docker compose up -d
```

Servicios disponibles:
- PostgreSQL: `localhost:5432`
- pgAdmin: `http://localhost:5050` (opcional)

### Variables de Entorno

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/umltool
OPENAI_API_KEY=sk-your-openai-key-here
PORT=3001
```

## 🤝 Colaboración

La aplicación soporta colaboración en tiempo real:

- **Locks**: Los elementos se bloquean automáticamente cuando un usuario los edita
- **Sincronización**: Los cambios se propagan instantáneamente a todos los usuarios
- **Conflictos**: Se resuelven automáticamente usando timestamps

## 🧪 Testing

### Frontend
```bash
cd frontend
npm run test
```

### Backend
```bash
cd server
npm run test
```

### API Testing
Importa la colección Postman generada automáticamente para probar los endpoints REST.

## 📈 Roadmap

- [ ] Soporte para más tipos de diagramas UML
- [ ] Integración con Git para versionado
- [ ] Plantillas personalizables para generación de código
- [ ] Exportación a otros formatos (PlantUML, Mermaid)
- [ ] Autenticación y autorización
- [ ] Historial de cambios y rollback

## 🐛 Troubleshooting

### Problemas Comunes

1. **Error de conexión a BD**: Verificar que PostgreSQL esté corriendo con `docker compose ps`
2. **Error de OpenAI**: Verificar que la API key esté configurada en `.env`
3. **Puertos ocupados**: Cambiar puertos en configuración si hay conflictos

### Logs

```bash
# Backend logs
cd server && npm run dev

# Database logs
cd db && docker compose logs -f postgres
```

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Para soporte técnico o preguntas, abre un issue en el repositorio.
