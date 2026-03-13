# ScriptCat Cloud Server (MVP)

ScriptCat 云控服务端 - MVP版本

## 项目简介

基于Java Spring Boot开发的轻量级WebSocket服务端，实现与Chrome插件的实时连接，提供自动化脚本的云控管理能力。

**MVP版本特点:**

- ✅ 纯内存存储，无数据库依赖
- ✅ 单机部署，无集群考虑
- ✅ 简化认证，user作为唯一标识
- ✅ 客户端脚本为准，服务端不存储code
- ✅ 快速启动，零配置

## 技术栈

- Java 17+
- Spring Boot 3.2.0
- Spring WebSocket + STOMP
- Maven 3.9+

## 快速开始

### 环境要求

- JDK 17 或更高版本
- Maven 3.9 或更高版本

### 构建项目

```bash
cd cloud-server
mvn clean package
```

### 启动服务

```bash
java -jar target/cloud-server-1.0.0-MVP.jar
```

或者使用脚本:

```bash
./scripts/run.sh
```

服务将在 `http://localhost:8080` 启动

## WebSocket连接

### 连接地址

```
ws://localhost:8080/ws
```

### 认证

连接时需要在header中携带:

- `username`: 用户名（必填）

### 消息格式

所有消息采用JSON格式:

```json
{
  "id": "msg-123456",
  "type": "AUTH",
  "action": "auth.login",
  "timestamp": 1234567890000,
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {
    // 具体数据
  }
}
```

## 消息类型

### 1. 认证消息 (AUTH)

**客户端 → 服务端:**

```json
{
  "type": "AUTH",
  "action": "auth.login",
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {
    "version": "1.0.0",
    "platform": "chrome"
  }
}
```

**服务端 → 客户端:**

```json
{
  "success": true,
  "message": "Authentication successful"
}
```

### 2. 脚本列表消息 (SCRIPT_LIST)

**客户端 → 服务端:**

```json
{
  "type": "SCRIPT_LIST",
  "action": "script.sync",
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {
    "scripts": [
      {
        "id": "script-1",
        "name": "Example Script",
        "version": "1.0.0",
        "metadata": {
          "namespace": "https://example.com",
          "description": "Example script"
        }
      }
    ]
  }
}
```

### 3. 执行消息 (EXECUTE)

**服务端 → 客户端:**

```json
{
  "type": "EXECUTE",
  "action": "script.execute",
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {
    "taskId": "task-uuid",
    "scriptId": "script-1",
    "params": {}
  }
}
```

**客户端 → 服务端:**

```json
{
  "type": "EXECUTE",
  "action": "script.result",
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {
    "taskId": "task-uuid",
    "success": true,
    "result": "execution result",
    "executionTime": 1234
  }
}
```

### 4. 心跳消息 (HEARTBEAT)

**客户端 → 服务端:**

```json
{
  "type": "HEARTBEAT",
  "action": "ping",
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {}
}
```

## REST API

### 获取客户端列表

```
GET /api/clients?username={username}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "clientId": "client-uuid",
        "username": "user@example.com",
        "status": "ONLINE",
        "connectedAt": "2024-01-01T00:00:00"
      }
    ],
    "total": 1
  }
}
```

### 获取脚本列表

```
GET /api/scripts?username={username}
```

### 执行脚本

```
POST /api/scripts/{scriptId}/execute
Content-Type: application/json

{
  "username": "user@example.com",
  "params": {}
}
```

### 获取任务状态

```
GET /api/tasks/{taskId}?username={username}
```

## 配置说明

配置文件位于 `src/main/resources/application.yml`

```yaml
server:
  port: 8080

app:
  websocket:
    heartbeat-interval: 30000 # 心跳间隔(毫秒)
    connection-timeout: 90000 # 连接超时(毫秒)

  execution:
    timeout: 30000 # 执行超时(毫秒)
    max-concurrent: 100 # 最大并发数
```

## 项目结构

```
cloud-server/
├── src/main/java/org/scriptcat/cloudserver/
│   ├── ScriptCatCloudServerApplication.java  # 主类
│   ├── config/                               # 配置类
│   │   └── WebSocketConfig.java
│   ├── websocket/                            # WebSocket模块
│   │   ├── handler/
│   │   ├── interceptor/
│   │   └── message/
│   ├── client/                               # 客户端管理
│   │   ├── model/
│   │   └── service/
│   ├── script/                               # 脚本管理
│   │   ├── model/
│   │   └── service/
│   ├── execution/                            # 执行管理
│   │   ├── model/
│   │   └── service/
│   ├── user/                                 # 用户管理
│   │   ├── model/
│   │   └── service/
│   ├── controller/                           # REST API控制器
│   └── common/                               # 公共组件
│       ├── exception/
│       ├── response/
│       └── util/
└── pom.xml
```

## 开发指南

### 编译

```bash
mvn clean compile
```

### 运行测试

```bash
mvn test
```

### 打包

```bash
mvn clean package
```

## 注意事项

1. **数据持久化**: MVP版本使用内存存储，重启后数据将丢失
2. **认证机制**: 当前版本仅需username，无密码验证
3. **脚本存储**: 服务端不存储脚本代码，仅存储元数据
4. **并发限制**: 单机部署，适合中小规模使用

## 后续优化方向

- 支持数据库持久化
- 实现完整的用户认证
- 支持集群部署
- 添加API限流和熔断
- 实现审计日志

## 许可证

MIT License

## 联系方式

ScriptCat Team
