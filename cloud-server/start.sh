#!/bin/bash

echo "Starting ScriptCat Cloud Server (MVP)..."
echo "=========================================="
echo ""

# Check Java version
if ! command -v java &> /dev/null; then
    echo "❌ Error: Java is not installed"
    echo "Please install Java 17 or higher"
    exit 1
fi

# Check Java version
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 17 ]; then
    echo "❌ Error: Java version must be 17 or higher"
    echo "Current version: $(java -version 2>&1 | head -n 1)"
    exit 1
fi

echo "✅ Java version: $(java -version 2>&1 | head -n 1)"
echo ""

# Check if JAR exists
JAR_FILE="target/cloud-server-1.0.0-MVP.jar"
if [ ! -f "$JAR_FILE" ]; then
    echo "📦 JAR file not found. Building project..."
    mvn clean package -DskipTests
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
    echo "✅ Build completed"
    echo ""
fi

# Start server
echo "🚀 Starting server on port 8080..."
echo "WebSocket endpoint: ws://localhost:8080/ws"
echo "Test page: http://localhost:8080/index.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

java -jar "$JAR_FILE"
