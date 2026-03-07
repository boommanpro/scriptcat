# ScriptCat MCP Server API 文档

## 概述

ScriptCat MCP Server 是一个基于 Spring Boot 和 MCP (Model Context Protocol) 协议的服务端实现，用于将 Chrome 插件端的脚本暴露为可调用的 MCP 工具。

## 服务端配置

### LM-Studio 配置示例

```json
{
  "mcpServers": {
    "scriptcat-mcp-server": {
      "url": "http://localhost:8080",
      "headers": {
        "Authorization": "Bearer <YOUR_USERNAME>"
      }
    }
  }
}
```

## 认证机制

### Bearer Token 认证

所有 MCP 接口（除健康检查和信息接口外）都需要 Bearer Token 认证。

**请求头格式：**
```
Authorization: Bearer <username>
```

**示例：**
```bash
curl -H "Authorization: Bearer boommanpro" http://localhost:8080/mcp/tools
```

## MCP 协议实现

### 支持的 MCP 方法

| 方法 | 说明 |
|------|------|
| `initialize` | 初始化 MCP 连接 |
| `tools/list` | 获取可用工具列表 |
| `tools/call` | 调用指定工具 |
| `ping` | 心跳检测 |

### SSE 连接

**端点：** `GET /sse`

**认证：** 需要 Bearer Token

**描述：** 建立 Server-Sent Events 连接

**响应示例：**
```
id:<session-id>
event:endpoint
data:/mcp/message?sessionId=<session-id>
```

### MCP 消息端点

**端点：** `POST /mcp/message`

**认证：** 需要 Bearer Token

**Content-Type：** `application/json`

#### 初始化请求

```bash
curl -X POST \
  -H "Authorization: Bearer boommanpro" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }' \
  http://localhost:8080/mcp/message
```

**响应：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {"listChanged": true},
      "resources": {"subscribe": false, "listChanged": false},
      "prompts": {"listChanged": false}
    },
    "serverInfo": {
      "name": "scriptcat-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

#### 获取工具列表

```bash
curl -X POST \
  -H "Authorization: Bearer boommanpro" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' \
  http://localhost:8080/mcp/message
```

**响应：**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "test",
        "description": "test",
        "inputSchema": {
          "type": "object",
          "properties": {}
        }
      }
    ]
  }
}
```

#### 调用工具

```bash
curl -X POST \
  -H "Authorization: Bearer boommanpro" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "test",
      "arguments": {}
    }
  }' \
  http://localhost:8080/mcp/message
```

**响应：**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Execution result..."
      }
    ],
    "isError": false
  }
}
```

## REST API 接口

### 1. 健康检查接口

**端点：** `GET /mcp/health`

**认证：** 不需要

**响应示例：**
```json
{
  "status": "UP",
  "timestamp": 1772855670205
}
```

### 2. 服务信息接口

**端点：** `GET /mcp/info`

**认证：** 不需要

**响应示例：**
```json
{
  "name": "scriptcat-mcp-server",
  "version": "1.0.0",
  "protocol": "streamable-http",
  "capabilities": {
    "tools": true,
    "resources": false,
    "prompts": false
  }
}
```

### 3. 工具列表接口 (REST)

**端点：** `GET /mcp/tools`

**认证：** 需要 Bearer Token

**请求示例：**
```bash
curl -H "Authorization: Bearer boommanpro" http://localhost:8080/mcp/tools
```

**响应示例：**
```json
{
  "username": "boommanpro",
  "count": 1,
  "tools": [
    {
      "name": "test",
      "description": "test",
      "inputSchema": "{\"type\":\"object\",\"properties\":{}}"
    }
  ]
}
```

### 4. 工具调用接口 (REST)

**端点：** `POST /mcp/tools/call`

**认证：** 需要 Bearer Token

**Content-Type：** `application/json`

**请求体：**
```json
{
  "name": "tool_name",
  "arguments": {
    "param1": "value1"
  }
}
```

## 工具动态注册

### 通过 WebSocket 同步脚本

当 Chrome 插件连接并发送 `SCRIPT_LIST` 消息时，服务端会自动将脚本注册为 MCP 工具。

**WebSocket 消息格式：**
```json
{
  "type": "SCRIPT_LIST",
  "action": "script.sync",
  "username": "boommanpro",
  "clientId": "client-123",
  "data": {
    "scripts": [
      {
        "id": "script-001",
        "name": "Example Script",
        "version": "1.0.0",
        "metadata": {
          "description": "This is an example script",
          "parameters": {
            "type": "object",
            "properties": {
              "url": {
                "type": "string",
                "description": "Target URL"
              }
            },
            "required": ["url"]
          }
        }
      }
    ]
  }
}
```

### 工具命名规则

工具名称由脚本名称自动生成：
1. 转换为小写
2. 将非字母数字字符替换为下划线
3. 移除连续下划线
4. 移除首尾下划线

**示例：**
- "Example Script" → "example_script"
- "My-Test@Script" → "my_test_script"
- "测试脚本" → "script_<scriptId>"

## 配置说明

### application.yml 配置

```yaml
spring:
  ai:
    mcp:
      server:
        name: scriptcat-mcp-server
        version: 1.0.0
        type: SYNC
        protocol: SSE
        sse-message-endpoint: /mcp/message
        tool-change-notification: true

app:
  mcp:
    auth:
      enabled: true
      header-name: Authorization
      token-prefix: "Bearer "
  
  execution:
    timeout: 30000
    max-concurrent: 100
```

### 配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `app.mcp.auth.enabled` | 是否启用认证 | true |
| `app.mcp.auth.header-name` | 认证头名称 | Authorization |
| `app.mcp.auth.token-prefix` | Token 前缀 | "Bearer " |
| `app.execution.timeout` | 执行超时时间（毫秒） | 30000 |
| `app.execution.max-concurrent` | 最大并发数 | 100 |

## 工具隔离机制

每个用户的工具完全隔离：
- 用户只能看到通过自己 Token 认证的工具
- 工具调用时会验证用户权限
- 不同用户的同名工具互不影响

## 执行流程

```
MCP Client → MCP Server → WebSocket → Chrome Plugin → Script Execution
     ↓            ↓            ↓              ↓              ↓
  调用工具    验证权限    发送执行指令    执行脚本      返回结果
```

1. MCP 客户端发起工具调用请求
2. 服务端验证 Bearer Token
3. 服务端查找对应的脚本和客户端
4. 通过 WebSocket 发送执行指令到 Chrome 插件
5. Chrome 插件执行脚本并返回结果
6. 服务端将结果返回给 MCP 客户端

## 错误处理

### JSON-RPC 错误响应

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Error message"
  }
}
```

### 常见错误

| 错误 | 说明 |
|------|------|
| `Tool not found` | 工具不存在 |
| `Client offline` | 客户端离线 |
| `Tool execution timeout` | 执行超时 |
| `Unauthorized` | 认证失败 |

## 文件结构

```
src/main/java/org/scriptcat/cloudserver/mcp/
├── config/
│   ├── McpAuthInterceptor.java      # 认证拦截器
│   ├── McpAuthProperties.java       # 认证配置属性
│   ├── McpToolConfiguration.java    # 工具配置
│   └── McpWebMvcConfig.java         # WebMvc配置
├── controller/
│   ├── McpController.java           # REST API控制器
│   └── McpSseController.java        # SSE控制器
├── exception/
│   ├── McpAuthException.java        # 认证异常
│   ├── McpExecutionException.java   # 执行异常
│   ├── McpExceptionHandler.java     # 异常处理
│   └── McpToolNotFoundException.java # 工具未找到异常
├── listener/
│   └── ScriptSyncEventListener.java # 脚本同步监听器
└── service/
    ├── McpDynamicToolProvider.java  # 动态工具提供者
    ├── McpToolExecutionService.java # 工具执行服务
    └── McpToolRegistry.java         # 工具注册表
```
