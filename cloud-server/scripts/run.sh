#!/bin/bash

echo "Starting ScriptCat Cloud Server..."

# 检查Java版本
if ! command -v java &> /dev/null; then
    echo "Error: Java is not installed"
    exit 1
fi

# 检查JAR文件是否存在
JAR_FILE="target/cloud-server-1.0.0-MVP.jar"
if [ ! -f "$JAR_FILE" ]; then
    echo "JAR file not found. Building project..."
    mvn clean package -DskipTests
fi

# 启动服务
echo "Starting server on port 8080..."
java -jar "$JAR_FILE"
