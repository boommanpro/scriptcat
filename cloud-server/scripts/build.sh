#!/bin/bash

echo "Building ScriptCat Cloud Server..."

# 清理并编译
mvn clean compile

# 运行测试
mvn test

# 打包
mvn package -DskipTests

echo "Build completed successfully!"
echo "JAR file: target/cloud-server-1.0.0-MVP.jar"
