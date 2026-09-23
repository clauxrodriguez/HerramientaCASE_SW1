@echo off
echo 🚀 Starting UML Diagram Tool...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

REM Start PostgreSQL database
echo 📊 Starting PostgreSQL database...
docker compose up -d postgres

REM Wait for database to be ready
echo ⏳ Waiting for database to be ready...
timeout /t 10 /nobreak >nul

REM Check if .env file exists in server directory
if not exist "server\.env" (
    echo 📝 Creating .env file from template...
    copy "server\env.example" "server\.env"
    echo ⚠️  Please edit server\.env and add your OpenAI API key
)

REM Install server dependencies
echo 📦 Installing server dependencies...
cd server
if not exist "node_modules" (
    npm install
)

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd ..\frontend
if not exist "node_modules" (
    npm install
)

cd ..

echo.
echo 🎉 Setup complete! You can now start the application:
echo.
echo 1. Start the backend server:
echo    cd server ^&^& npm run dev
echo.
echo 2. Start the frontend (in a new terminal):
echo    cd frontend ^&^& npm run dev
echo.
echo 3. Access the application:
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:3001
echo    pgAdmin:  http://localhost:5050 (admin@umltool.com / admin123)
echo.
echo 📚 For more information, see README.md
pause

