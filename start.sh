#!/bin/bash

# UML Diagram Tool - Quick Start Script
echo "🚀 Starting UML Diagram Tool..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start PostgreSQL database
echo "📊 Starting PostgreSQL database..."
docker compose up -d postgres

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if database is ready
until docker exec uml-tool-postgres pg_isready -U postgres -d umltool > /dev/null 2>&1; do
    echo "⏳ Still waiting for database..."
    sleep 2
done

echo "✅ Database is ready!"

# Check if .env file exists in server directory
if [ ! -f "server/.env" ]; then
    echo "📝 Creating .env file from template..."
    cp server/env.example server/.env
    echo "⚠️  Please edit server/.env and add your OpenAI API key"
fi

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
if [ ! -d "node_modules" ]; then
    npm install
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

cd ..

echo ""
echo "🎉 Setup complete! You can now start the application:"
echo ""
echo "1. Start the backend server:"
echo "   cd server && npm run dev"
echo ""
echo "2. Start the frontend (in a new terminal):"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Access the application:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo "   pgAdmin:  http://localhost:5050 (admin@umltool.com / admin123)"
echo ""
echo "📚 For more information, see README.md"

