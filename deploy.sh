#!/bin/bash
set -e

echo "🚀 Instalando dependencias..."
apt-get update
apt-get install -y docker.io docker-compose git

echo "🔧 Iniciando Docker..."
systemctl start docker
systemctl enable docker

echo "📦 Clonando repositorio..."
cd /root
rm -rf PRIMER-PARCIAL-SW
git clone https://github.com/Sebastian-M-C/PRIMER-PARCIAL-SW.git
cd PRIMER-PARCIAL-SW
git checkout segundo-parcial

echo "🔑 Configurando variables de entorno..."
# Las claves sensibles NO deben almacenarse en el repo.
# Si están definidas en el entorno (ej. CI / servidor), las volcamos a .env;
# en caso contrario quedarán vacías. Asegúrate de configurar las variables
# OPENAI_API_KEY y GOOGLE_API_KEY en el entorno del servidor o en GitHub Secrets.
cat > .env << EOF
OPENAI_API_KEY=${OPENAI_API_KEY:-}
GOOGLE_API_KEY=${GOOGLE_API_KEY:-}
GEMINI_API_KEY=${GEMINI_API_KEY:-}
EOF

echo "🐳 Construyendo y levantando contenedores..."
docker compose -f docker-compose.prod.yml down || true
docker compose -f docker-compose.prod.yml up -d --build

echo "✅ Despliegue completado!"
echo "🌐 Accede a: https://software3dlv.duckdns.org"
