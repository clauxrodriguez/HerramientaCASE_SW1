# 📚 Documentación Completa del Proyecto UML Diagram Tool

## 📋 Índice
- [1. Resumen del Proyecto](#1-resumen-del-proyecto)
- [2. Arquitectura del Sistema](#2-arquitectura-del-sistema)
- [3. Proceso de Dockerización](#3-proceso-de-dockerización)
- [4. Configuración del Servidor de Producción](#4-configuración-del-servidor-de-producción)
- [5. Configuración SSL con Caddy](#5-configuración-ssl-con-caddy)
- [6. Problemas Encontrados y Soluciones](#6-problemas-encontrados-y-soluciones)
- [7. Guía de Mantenimiento](#7-guía-de-mantenimiento)
- [8. Variables de Entorno](#8-variables-de-entorno)

---

## 1. Resumen del Proyecto

**Aplicación:** Herramienta colaborativa de diagramas UML en tiempo real  
**Dominio:** https://software3dlv.duckdns.org  
**Servidor:** Ubuntu 25.10 x64 (Digital Ocean - SFO2)  
**IP:** 178.128.65.114  
**Usuario:** root  

### Funcionalidades Principales
- ✅ Generación de diagramas UML desde texto con OpenAI
- ✅ Conversión de imágenes a diagramas UML con Gemini Vision
- ✅ Edición colaborativa en tiempo real con Socket.io
- ✅ Persistencia de diagramas en PostgreSQL
- ✅ Interfaz React con canvas interactivo (Konva)

---

## 2. Arquitectura del Sistema

### Stack Tecnológico

#### Frontend
- **Framework:** React 18.2.0 + TypeScript 5.2.2
- **Build Tool:** Vite 5.4.20
- **Estado Global:** Zustand 4.4.7
- **Canvas:** React-Konva 18.2.10
- **Comunicación:** Socket.io-client 4.7.4
- **Servidor Web:** Nginx (Alpine)

#### Backend
- **Runtime:** Node.js 18 (Alpine)
- **Framework:** Express 4.21.2
- **WebSockets:** Socket.io 4.7.4
- **Base de Datos:** PostgreSQL 15 (Alpine)
- **IA/ML:**
  - OpenAI API 4.20.1 (generación de diagramas desde texto)
  - Google Gemini Vision (análisis de imágenes)
  - Tesseract.js 6.0.1 (OCR fallback)

#### Infraestructura
- **Orquestación:** Docker Compose v3.8
- **Reverse Proxy:** Caddy 2 (Alpine)
- **SSL:** Let's Encrypt (automático)
- **Networking:** Bridge network (uml-network)

### Diagrama de Arquitectura

```
Internet
   ↓
[Caddy Reverse Proxy] :80, :443
   ├── SSL/TLS (Let's Encrypt automático)
   ├── /api/* → Backend :3001
   ├── /socket.io/* → Backend :3001 (HTTP/1.1)
   └── /* → Frontend :80
        ↓
[Frontend Container]
   └── Nginx → React App
        ↓
[Backend Container]
   ├── Express + Socket.io
   ├── OpenAI API
   ├── Gemini Vision API
   └── PostgreSQL Client
        ↓
[PostgreSQL Container]
   └── Database :5432 (interno)
```

---

## 3. Proceso de Dockerización

### 3.1 Entorno de Desarrollo Local

#### Archivo: `docker-compose.yml`

**Servicios:**
1. **postgres** - Base de datos PostgreSQL
2. **backend** - API Node.js con Express
3. **frontend** - React App con Vite
4. **pgadmin** - Administrador de BD (opcional)

**Características:**
- Puertos expuestos para desarrollo
- Hot reload habilitado
- Variables de entorno desde `.env`

#### Comandos de desarrollo:
```bash
# Iniciar todos los servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Detener servicios
docker compose down

# Reconstruir después de cambios
docker compose up -d --build
```

### 3.2 Entorno de Producción

#### Archivo: `docker-compose.prod.yml`

**Mejoras de seguridad:**
- Base de datos sin exposición de puertos externos
- Frontend construido con build optimizado
- Caddy como único punto de entrada
- Variables de entorno separadas

**Red interna:**
```yaml
networks:
  uml-network:
    driver: bridge
```

Todos los contenedores se comunican internamente sin exponer puertos innecesarios.

---

## 4. Configuración del Servidor de Producción

### 4.1 Preparación Inicial del Servidor

#### Instalación de Dependencias

```bash
# Conectar al servidor
ssh root@178.128.65.114

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt install docker-compose-plugin -y

# Instalar Git
apt install git -y

# Verificar instalaciones
docker --version
docker compose version
git --version
```

### 4.2 Despliegue del Proyecto

```bash
# Clonar o copiar proyecto
# Opción 1: Git
git clone <tu-repositorio> PRIMER-PARCIAL-SW
cd PRIMER-PARCIAL-SW

# Opción 2: SCP desde local
scp -r ./* root@178.128.65.114:/root/PRIMER-PARCIAL-SW/
```

#### Configurar variables de entorno:

```bash
# Crear archivo .env en el servidor
cd /root/PRIMER-PARCIAL-SW
nano .env
```

Contenido del `.env`:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
GOOGLE_API_KEY=AIzaSyDxxxxxxxxxxxxx
GEMINI_API_KEY=
```

### 4.3 Construcción y Despliegue

```bash
# Construir contenedores
cd /root/PRIMER-PARCIAL-SW
docker compose -f docker-compose.prod.yml build

# Iniciar servicios
docker compose -f docker-compose.prod.yml up -d

# Verificar estado
docker ps
docker compose logs -f
```

---

## 5. Configuración SSL con Caddy

### 5.1 Archivo Caddyfile

**Ubicación:** `./Caddyfile`

```caddy
software3dlv.duckdns.org {
    # Backend API
    handle /api/* {
        reverse_proxy backend:3001
    }

    # Socket.io con HTTP/1.1 (requerido)
    @websockets {
        path /socket.io/*
    }
    handle @websockets {
        reverse_proxy backend:3001 {
            transport http {
                versions 1.1
            }
        }
    }

    # Health check
    handle /health {
        reverse_proxy backend:3001
    }

    # Frontend estático
    handle {
        reverse_proxy frontend:80
    }

    # Headers de seguridad
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Logs
    log {
        output file /var/log/caddy/access.log
    }
}
```

### 5.2 Certificado SSL Automático

Caddy obtiene automáticamente certificados de Let's Encrypt al iniciar:

```bash
# Ver logs de obtención de certificado
docker logs uml-caddy

# Verificar certificado
curl -I https://software3dlv.duckdns.org
```

**Características:**
- ✅ Renovación automática cada 60 días
- ✅ Redirección HTTP → HTTPS automática
- ✅ HTTPS/2 por defecto (excepto Socket.io)
- ✅ Sin configuración manual necesaria

---

## 6. Problemas Encontrados y Soluciones

### 6.1 Error CORS - Frontend no puede conectar con Backend

**Síntoma:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Causa:** Backend no tenía configurado el dominio de producción en CORS.

**Solución:**

**Archivo:** `server/src/index.ts`

```typescript
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost',
    'http://localhost:80',
    'https://software3dlv.duckdns.org'  // ← Agregado
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));

// Socket.io con mismos orígenes
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost',
      'http://localhost:80',
      'https://software3dlv.duckdns.org'  // ← Agregado
    ],
    credentials: true
  }
});
```

### 6.2 Error Socket.io - "xhr poll error" y 502 Bad Gateway

**Síntoma:**
```
WebSocket connection failed
xhr poll error
502 Bad Gateway
```

**Causa:** Socket.io no es compatible con HTTP/2 por defecto. Caddy usa HTTP/2.

**Solución:** Forzar HTTP/1.1 para rutas de Socket.io en Caddyfile:

```caddy
@websockets {
    path /socket.io/*
}
handle @websockets {
    reverse_proxy backend:3001 {
        transport http {
            versions 1.1  # ← Forzar HTTP/1.1
        }
    }
}
```

### 6.3 Error SSL PostgreSQL - Connection refused

**Síntoma:**
```
Error: unable to get local issuer certificate
Connection refused to PostgreSQL
```

**Causa:** PostgreSQL en Docker no necesita SSL para conexiones internas.

**Solución:**

**Archivo:** `server/src/db/connection.ts`

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false  // ← Cambiar de true a false
});
```

### 6.4 Frontend usa localhost en vez de dominio de producción

**Síntoma:** Frontend construido con URLs de localhost en producción.

**Solución:**

**Archivo:** `frontend/Dockerfile.prod`

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Variables de entorno para build
ARG VITE_API_URL=https://software3dlv.duckdns.org
ARG VITE_SERVER_URL=https://software3dlv.duckdns.org

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Archivo:** `frontend/src/config.ts`

```typescript
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
```

### 6.5 Error 502 en carga de imágenes - API Key vacía

**Síntoma:**
```
POST /api/ai/image-to-diagram 502 (Bad Gateway)
AI provider failed
```

**Causa:** `GEMINI_API_KEY` definida como cadena vacía (`""`) en Docker, impidiendo fallback a `GOOGLE_API_KEY`.

**Solución:**

**Archivo:** `server/src/ai/gemini/geminiClient.ts`

```typescript
export async function callGemini(opts: { prompt: string; imagePath?: string; timeoutMs?: number }): Promise<GeminiResponse> {
  // Filtrar cadenas vacías (Docker puede pasar "")
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
  const googleKey = process.env.GOOGLE_API_KEY?.trim() || undefined;
  const openaiKey = process.env.OPENAI_API_KEY?.trim() || undefined;
  const apiKey = geminiKey ?? googleKey ?? openaiKey;
  
  if (!apiKey) {
    // Fallback sin API key
  }
  // ...
}
```

### 6.6 Error 503 - Modelo Gemini sobrecargado

**Síntoma:**
```
The model is overloaded. Please try again later.
Status: 503
```

**Causa:** API de Google Gemini temporalmente saturada.

**Soluciones:**
1. **Esperar unos minutos** - El error es temporal
2. **Cambiar modelo** - Usar alternativa menos saturada:

```bash
# Opción 1: Gemini 1.5 Pro
echo "GEMINI_MODEL=gemini-1.5-pro-latest" >> .env

# Opción 2: Gemini 1.5 Flash
echo "GEMINI_MODEL=gemini-1.5-flash-latest" >> .env

# Reiniciar backend
docker compose restart backend
```

### 6.7 🔧 Guía Rápida: Problema con Carga de Imágenes (Error 502)

Si al subir una imagen obtienes error 502, sigue estos pasos en orden:

#### Paso 1: Verificar logs del backend
```bash
# Conectar al servidor
ssh root@178.128.65.114

# Ver últimos 50 logs del backend
docker logs uml-backend-prod --tail=50
```

**Busca estos mensajes:**
- ✅ `"Analysis completed"` + `"200"` = Funciona bien
- ❌ `"503"` + `"overloaded"` = API sobrecargada (temporal)
- ❌ `"502"` + `"0 classes, 0 relations"` = Error de API Key

#### Paso 2: Si es error 503 (API sobrecargada)
```bash
# Simplemente reiniciar backend
docker compose restart backend

# Esperar 10 segundos
sleep 10

# Verificar que inició correctamente
docker logs uml-backend-prod --tail=10
```

Luego **intenta subir la imagen de nuevo**. El error 503 es temporal.

#### Paso 3: Si es error 502 persistente (API Key)
```bash
# Verificar que las API keys están cargadas
docker exec uml-backend-prod env | grep -E 'GOOGLE|GEMINI|OPENAI'

# Deberías ver:
# GOOGLE_API_KEY=AIzaSyD... (con valor)
# GEMINI_API_KEY= (puede estar vacío)
# OPENAI_API_KEY=sk-proj-... (con valor)
```

Si `GOOGLE_API_KEY` está vacío:
```bash
# Verificar archivo .env
cat /root/PRIMER-PARCIAL-SW/.env

# Si falta, agregarlo
echo "GOOGLE_API_KEY=AIzaSyDruDxONi5_I6t1ymeeZstFGksxm9VhMSg" >> .env

# Reconstruir backend con nueva variable
docker compose down backend
docker compose up -d backend
```

#### Paso 4: Reinicio completo (último recurso)
```bash
# Detener todo
docker compose down

# Iniciar todo de nuevo
docker compose up -d

# Verificar estado
docker ps

# Ver logs en tiempo real
docker logs uml-backend-prod -f
```

#### Comandos de Diagnóstico Rápido

```bash
# 1. ¿Está corriendo el backend?
docker ps | grep backend

# 2. ¿Hay errores recientes?
docker logs uml-backend-prod --tail=30

# 3. ¿Las API keys están cargadas?
docker exec uml-backend-prod env | grep GOOGLE_API_KEY

# 4. ¿El servicio responde?
curl https://software3dlv.duckdns.org/health

# 5. Reinicio rápido solo del backend
docker compose restart backend && docker logs uml-backend-prod -f
```

#### Resumen de Comandos por Escenario

**Escenario 1: Error temporal (503)**
```bash
ssh root@178.128.65.114
docker compose restart backend
# Esperar 10 segundos e intentar de nuevo
```

**Escenario 2: Error persistente (502)**
```bash
ssh root@178.128.65.114
docker logs uml-backend-prod --tail=50
# Ver el error específico
docker exec uml-backend-prod env | grep GOOGLE_API_KEY
# Verificar API key
docker compose restart backend
```

**Escenario 3: Nada funciona**
```bash
ssh root@178.128.65.114
cd /root/PRIMER-PARCIAL-SW
docker compose down
docker compose up -d
docker ps
docker logs uml-backend-prod -f
```

#### ⚡ Comando Todo-en-Uno (copia y pega)

```bash
ssh root@178.128.65.114 "cd /root/PRIMER-PARCIAL-SW && docker compose restart backend && echo '✅ Backend reiniciado' && sleep 3 && docker logs uml-backend-prod --tail=10"
```

Este comando:
1. Conecta al servidor
2. Va al directorio del proyecto
3. Reinicia el backend
4. Espera 3 segundos
5. Muestra los últimos 10 logs

**Después de ejecutar cualquiera de estos comandos, vuelve a intentar subir la imagen en tu navegador.**

---

## 7. Guía de Mantenimiento

### 7.1 Comandos Útiles

#### Gestión de Contenedores

```bash
# Ver estado de todos los contenedores
docker ps

# Ver logs en tiempo real
docker logs uml-backend-prod -f
docker logs uml-frontend-prod -f
docker logs uml-caddy -f
docker logs uml-postgres-prod -f

# Reiniciar un servicio específico
docker compose restart backend
docker compose restart frontend
docker compose restart caddy

# Reiniciar todos los servicios
docker compose restart

# Detener todos los servicios
docker compose down

# Iniciar servicios
docker compose up -d

# Reconstruir y reiniciar
docker compose down
docker compose up -d --build
```

#### Gestión de Base de Datos

```bash
# Backup de base de datos
docker exec uml-postgres-prod pg_dump -U admin uml_diagrams > backup.sql

# Restaurar base de datos
docker exec -i uml-postgres-prod psql -U admin uml_diagrams < backup.sql

# Conectar a PostgreSQL
docker exec -it uml-postgres-prod psql -U admin -d uml_diagrams

# Ver tablas
docker exec uml-postgres-prod psql -U admin -d uml_diagrams -c "\dt"
```

#### Monitoreo de Recursos

```bash
# Ver uso de recursos
docker stats

# Ver espacio en disco
docker system df

# Limpiar recursos no usados
docker system prune -a

# Limpiar volúmenes
docker volume prune
```

### 7.2 Actualización del Código

#### Desde local al servidor:

```bash
# Copiar archivos modificados
scp -r ./server root@178.128.65.114:/root/PRIMER-PARCIAL-SW/
scp -r ./frontend root@178.128.65.114:/root/PRIMER-PARCIAL-SW/

# Conectar al servidor
ssh root@178.128.65.114

# Reconstruir servicios
cd /root/PRIMER-PARCIAL-SW
docker compose down
docker compose up -d --build
```

#### Actualización solo del backend:

```bash
# Copiar cambios
scp -r ./server root@178.128.65.114:/root/PRIMER-PARCIAL-SW/

# Reconstruir solo backend
ssh root@178.128.65.114 "cd /root/PRIMER-PARCIAL-SW && docker compose down backend && docker compose up -d --build backend"
```

#### Actualización solo del frontend:

```bash
# Copiar cambios
scp -r ./frontend root@178.128.65.114:/root/PRIMER-PARCIAL-SW/

# Reconstruir solo frontend
ssh root@178.128.65.114 "cd /root/PRIMER-PARCIAL-SW && docker compose down frontend && docker compose up -d --build frontend"
```

### 7.3 Verificación de Salud del Sistema

```bash
# Health check del backend
curl https://software3dlv.duckdns.org/health

# Verificar certificado SSL
curl -I https://software3dlv.duckdns.org

# Verificar conectividad de Socket.io
curl https://software3dlv.duckdns.org/socket.io/

# Ver estado de la base de datos
docker exec uml-postgres-prod pg_isready -U admin
```

### 7.4 Troubleshooting Rápido

#### Problema: Servicio no responde

```bash
# Ver estado
docker ps

# Ver logs
docker logs <nombre-contenedor> --tail=50

# Reiniciar servicio
docker compose restart <servicio>
```

#### Problema: Error 502 Bad Gateway

```bash
# Ver logs de Caddy
docker logs uml-caddy --tail=50

# Ver logs de backend
docker logs uml-backend-prod --tail=50

# Verificar conectividad interna
docker exec uml-caddy ping backend
docker exec uml-caddy ping frontend
```

#### Problema: Base de datos no conecta

```bash
# Verificar que PostgreSQL esté healthy
docker ps

# Ver logs de PostgreSQL
docker logs uml-postgres-prod --tail=50

# Verificar variables de entorno
docker exec uml-backend-prod env | grep DATABASE
```

---

## 8. Variables de Entorno

### 8.1 Variables del Backend

**Archivo:** `.env` (raíz del proyecto)

```env
# API Keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx          # OpenAI para generación de texto
GOOGLE_API_KEY=AIzaSyDxxxxxxxxxxxxx            # Google Gemini Vision para imágenes
GEMINI_API_KEY=                                 # Opcional, usa GOOGLE_API_KEY si está vacío

# Base de datos (configurado en docker-compose)
DATABASE_URL=postgresql://admin:password@postgres:5432/uml_diagrams

# Configuración de Gemini (opcional)
GEMINI_MODEL=gemini-2.5-flash                   # Modelo por defecto
GEMINI_API_VERSION=v1beta                       # Versión de API
```

### 8.2 Variables del Frontend

**Configuradas en build time:**

```env
VITE_API_URL=https://software3dlv.duckdns.org
VITE_SERVER_URL=https://software3dlv.duckdns.org
```

### 8.3 Cómo obtener las API Keys

#### OpenAI API Key
1. Ir a https://platform.openai.com/
2. Crear cuenta o iniciar sesión
3. Ir a API Keys
4. Crear nueva clave
5. Copiar y guardar en `.env`

#### Google Gemini API Key
1. Ir a https://makersuite.google.com/app/apikey
2. Iniciar sesión con cuenta Google
3. Crear API Key
4. Habilitar "Generative Language API"
5. Copiar y guardar en `.env`

---

## 9. Estructura de Archivos del Proyecto

```
PRIMER-PARCIAL-SW/
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── services/        # Servicios API
│   │   ├── store/           # Estado global (Zustand)
│   │   ├── hooks/           # Custom hooks
│   │   ├── types/           # TypeScript types
│   │   └── config.ts        # Configuración de URLs
│   ├── Dockerfile           # Build local
│   ├── Dockerfile.prod      # Build producción
│   ├── nginx.conf           # Config Nginx local
│   ├── nginx.prod.conf      # Config Nginx producción
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/          # Rutas Express
│   │   ├── db/              # Configuración PostgreSQL
│   │   ├── ai/              # Servicios de IA
│   │   │   ├── gemini/      # Gemini Vision
│   │   │   └── openai/      # OpenAI
│   │   ├── collaboration/   # Socket.io
│   │   └── index.ts         # Entry point
│   ├── Dockerfile           # Build backend
│   └── package.json
├── db/
│   └── init.sql            # Schema de base de datos
├── Caddyfile               # Configuración Caddy
├── docker-compose.yml      # Desarrollo local
├── docker-compose.prod.yml # Producción
├── .env                    # Variables de entorno
└── DOCUMENTACION_DESPLIEGUE.md  # Este archivo
```

---

## 10. URLs y Endpoints

### Producción

**URL Principal:** https://software3dlv.duckdns.org

**Endpoints del API:**
- `POST /api/ai/generate-diagram` - Generar diagrama desde texto
- `POST /api/ai/modify-diagram` - Modificar diagrama existente
- `POST /api/ai/image-to-diagram` - Convertir imagen a diagrama
- `GET /health` - Health check

**WebSocket:**
- `wss://software3dlv.duckdns.org/socket.io/` - Colaboración en tiempo real

### Desarrollo Local

**URL Principal:** http://localhost:5173

**Backend:** http://localhost:3001
**PostgreSQL:** localhost:5432
**pgAdmin:** http://localhost:5050

---

## 11. Checklist de Despliegue

### Pre-despliegue
- [ ] Código pusheado a repositorio Git
- [ ] Variables de entorno configuradas en `.env`
- [ ] API Keys válidas (OpenAI, Google Gemini)
- [ ] Dominio apuntando a IP del servidor (DuckDNS)
- [ ] Servidor con Docker y Docker Compose instalados

### Despliegue
- [ ] Copiar archivos al servidor
- [ ] Verificar `.env` en servidor
- [ ] Construir contenedores: `docker compose build`
- [ ] Iniciar servicios: `docker compose up -d`
- [ ] Verificar todos los contenedores: `docker ps`

### Post-despliegue
- [ ] Verificar certificado SSL: `https://software3dlv.duckdns.org`
- [ ] Probar health check: `/health`
- [ ] Probar generación de diagrama desde texto
- [ ] Probar conversión de imagen a diagrama
- [ ] Probar colaboración en tiempo real (Socket.io)
- [ ] Verificar logs sin errores

---

## 12. Contacto y Soporte

**Proyecto:** UML Diagram Tool  
**Versión:** 1.0.0  
**Última actualización:** 11 de Noviembre, 2025  

### Recursos Adicionales
- [Docker Documentation](https://docs.docker.com/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Socket.io Documentation](https://socket.io/docs/)

---

## 13. Mejoras Futuras

### Propuestas de Optimización
- [ ] Implementar caché con Redis para respuestas de IA
- [ ] Agregar sistema de autenticación con JWT
- [ ] Implementar rate limiting en el API
- [ ] Agregar monitoreo con Prometheus + Grafana
- [ ] Implementar CI/CD con GitHub Actions
- [ ] Agregar tests automatizados (Jest, Cypress)
- [ ] Implementar CDN para assets estáticos
- [ ] Agregar backup automático de base de datos

---

**¡Proyecto desplegado exitosamente! 🚀**
