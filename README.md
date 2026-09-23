# UML Diagram - Generador de Código Spring Boot

Una aplicación web colaborativa para crear diagramas UML de clases y generar automáticamente proyectos Spring Boot completos.

## 🚀 Características

- **Editor UML Visual**: Lienzo interactivo con react-konva para crear y editar diagramas de clases
- **Colaboración en Tiempo Real**: Múltiples usuarios pueden trabajar simultáneamente usando socket.io
- **Generación de Código**: Convierte diagramas UML a proyectos Spring Boot completos
- **IA Integrada**: Sugerencias automáticas y generación de clases desde texto natural
- **Exportación**: Descarga proyectos Spring Boot como archivos ZIP


## 📁 Estructura del Proyecto

```
root/
├── frontend/              # React + TypeScript + Vite
├── backend/                # Node.js + Express + socket.io
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
