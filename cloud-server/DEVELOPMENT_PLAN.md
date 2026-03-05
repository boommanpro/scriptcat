# ScriptCat Cloud Server MVP 开发计划

## 项目概述

基于Java开发轻量级WebSocket服务端，实现与Chrome插件的实时连接，提供自动化脚本的云控管理能力。**MVP版本采用纯内存存储，无数据库依赖，快速实现核心功能。**

---

## 一、项目规划与准备阶段

### 1.1 项目架构设计

#### 1.1.1 系统架构（简化版）
```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension (客户端)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Script管理    │  │ WebSocket    │  │ 状态监控     │      │
│  │ Module       │  │ Client       │  │ Module       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ WebSocket Protocol
┌─────────────────────────────────────────────────────────────┐
│                     Java Cloud Server (MVP)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WebSocket Handler Layer                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │  │
│  │  │ Connection  │  │ Message     │  │ Session      │ │  │
│  │  │ Manager     │  │ Handler     │  │ Manager      │ │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Business Logic Layer                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │  │
│  │  │ Client      │  │ Script      │  │ Execution    │ │  │
│  │  │ Service     │  │ Service     │  │ Service      │ │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              In-Memory Storage                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │  │
│  │  │ User        │  │ Script      │  │ Execution    │ │  │
│  │  │ Registry    │  │ Registry    │  │ Registry     │ │  │
│  │  │ (Map)       │  │ (Map)       │  │ (Map)        │ │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 1.1.2 核心设计原则

**MVP版本特点:**
- ✅ 纯内存存储，无数据库依赖
- ✅ 单机部署，无集群考虑
- ✅ 简化认证，user作为唯一标识
- ✅ 客户端脚本为准，服务端不存储code
- ✅ 快速启动，零配置

**数据存储策略:**
```java
// 用户注册表: Map<username, UserSession>
ConcurrentHashMap<String, UserSession> userRegistry;

// 客户端注册表: Map<clientId, ClientInfo>
ConcurrentHashMap<String, ClientInfo> clientRegistry;

// 脚本注册表: Map<username, Map<scriptId, ScriptInfo>>
ConcurrentHashMap<String, ConcurrentHashMap<String, ScriptInfo>> scriptRegistry;

// 执行任务注册表: Map<taskId, ExecutionTask>
ConcurrentHashMap<String, ExecutionTask> executionRegistry;
```

#### 1.1.3 模块划分

**核心模块（精简版）:**

1. **websocket-module**: WebSocket连接管理
   - 连接生命周期管理
   - 消息编解码
   - 心跳检测
   
2. **client-module**: 客户端管理模块
   - 客户端注册与发现
   - 客户端状态管理
   - 数据隔离（基于username）

3. **script-module**: 脚本管理模块
   - 脚本列表同步（客户端上报）
   - 脚本信息存储（不含code）
   - 脚本查询

4. **execution-module**: 执行管理模块
   - 执行任务调度
   - 状态跟踪
   - 结果收集

### 1.2 技术选型方案

#### 1.2.1 核心技术栈（精简版）
- **语言**: Java 17+
- **框架**: Spring Boot 3.x
- **WebSocket**: Spring WebSocket + STOMP
- **存储**: 纯内存（ConcurrentHashMap）
- **构建工具**: Maven 3.9+
- **测试**: JUnit 5, Mockito

#### 1.2.2 依赖库（精简版）
```xml
<dependencies>
    <!-- Spring Boot Starter -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-websocket</artifactId>
    </dependency>
    
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    
    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
    
    <!-- JSON Processing -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
    
    <!-- Utilities -->
    <dependency>
        <groupId>org.apache.commons</groupId>
        <artifactId>commons-lang3</artifactId>
    </dependency>
    
    <!-- Test -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### 1.3 项目目录结构（精简版）

```
cloud-server/
├── pom.xml
├── README.md
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── org/scriptcat/cloudserver/
│   │   │       ├── ScriptCatCloudServerApplication.java
│   │   │       ├── config/
│   │   │       │   ├── WebSocketConfig.java
│   │   │       │   └── AppConfig.java
│   │   │       ├── websocket/
│   │   │       │   ├── handler/
│   │   │       │   │   └── WebSocketMessageHandler.java
│   │   │       │   ├── interceptor/
│   │   │       │   │   └── AuthChannelInterceptor.java
│   │   │       │   └── message/
│   │   │       │       ├── Message.java
│   │   │       │       ├── MessageType.java
│   │   │       │       └── MessageBuilder.java
│   │   │       ├── client/
│   │   │       │   ├── service/
│   │   │       │   │   ├── ClientService.java
│   │   │       │   │   └── ClientRegistry.java
│   │   │       │   └── model/
│   │   │       │       ├── ClientInfo.java
│   │   │       │       └── ClientSession.java
│   │   │       ├── script/
│   │   │       │   ├── service/
│   │   │       │   │   ├── ScriptService.java
│   │   │       │   │   └── ScriptRegistry.java
│   │   │       │   └── model/
│   │   │       │       └── ScriptInfo.java
│   │   │       ├── execution/
│   │   │       │   ├── service/
│   │   │       │   │   ├── ExecutionService.java
│   │   │       │   │   └── ExecutionRegistry.java
│   │   │       │   └── model/
│   │   │       │       ├── ExecutionTask.java
│   │   │       │       └── ExecutionStatus.java
│   │   │       ├── user/
│   │   │       │   ├── service/
│   │   │       │   │   └── UserRegistry.java
│   │   │       │   └── model/
│   │   │       │       └── UserSession.java
│   │   │       └── common/
│   │   │           ├── exception/
│   │   │           │   ├── GlobalExceptionHandler.java
│   │   │           │   └── BusinessException.java
│   │   │           ├── response/
│   │   │           │   └── ApiResponse.java
│   │   │           └── util/
│   │   │               └── IdGenerator.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── static/
│   │           └── index.html
│   └── test/
│       └── java/
│           └── org/scriptcat/cloudserver/
│               ├── websocket/
│               │   └── WebSocketTest.java
│               └── service/
│                   ├── ClientServiceTest.java
│                   └── ExecutionServiceTest.java
└── scripts/
    └── run.sh
```

### 1.4 开发规范

#### 1.4.1 代码规范
- 遵循Google Java Style Guide
- 使用Lombok减少样板代码
- 所有public方法必须有Javadoc注释
- 使用SLF4J进行日志记录

#### 1.4.2 命名规范
- 类名: PascalCase (例: `ClientRegistry`)
- 方法名: camelCase (例: `registerClient`)
- 常量: UPPER_SNAKE_CASE (例: `MAX_RETRY_COUNT`)

---

## 二、核心功能开发阶段

### 2.1 WebSocket服务实现

#### 2.1.1 连接管理机制

**核心类设计:**

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
    }
    
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }
}
```

**会话管理器:**
```java
@Component
@Slf4j
public class ClientRegistry {
    
    private final ConcurrentHashMap<String, ClientSession> sessions = new ConcurrentHashMap<>();
    
    public void register(String username, String clientId, ClientSession session) {
        String key = buildKey(username, clientId);
        sessions.put(key, session);
        log.info("Client registered: {}", key);
    }
    
    public void unregister(String username, String clientId) {
        String key = buildKey(username, clientId);
        sessions.remove(key);
        log.info("Client unregistered: {}", key);
    }
    
    public ClientSession get(String username, String clientId) {
        return sessions.get(buildKey(username, clientId));
    }
    
    public List<ClientSession> getByUsername(String username) {
        return sessions.entrySet().stream()
            .filter(e -> e.getKey().startsWith(username + ":"))
            .map(Map.Entry::getValue)
            .collect(Collectors.toList());
    }
    
    private String buildKey(String username, String clientId) {
        return username + ":" + clientId;
    }
}
```

**心跳检测:**
- 客户端每30秒发送PING
- 服务端响应PONG
- 超时90秒未收到心跳则断开连接

#### 2.1.2 认证流程（简化版）

**认证机制:**
```java
@Component
public class AuthChannelInterceptor implements ChannelInterceptor {
    
    @Autowired
    private UserRegistry userRegistry;
    
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String username = accessor.getFirstNativeHeader("username");
            
            if (StringUtils.isEmpty(username)) {
                throw new IllegalArgumentException("Username is required");
            }
            
            // 创建用户会话（无需密码验证）
            UserSession session = new UserSession(username);
            userRegistry.register(username, session);
            
            accessor.setUser(new UserPrincipal(username));
        }
        
        return message;
    }
}
```

**用户会话:**
```java
@Data
@AllArgsConstructor
public class UserSession {
    private String username;
    private LocalDateTime createdAt;
    private Set<String> clientIds = ConcurrentHashMap.newKeySet();
    
    public UserSession(String username) {
        this.username = username;
        this.createdAt = LocalDateTime.now();
    }
}
```

#### 2.1.3 消息处理逻辑

**消息格式定义:**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Message {
    private String id;
    private MessageType type;
    private String action;
    private Long timestamp;
    private String username;
    private String clientId;
    private Map<String, Object> data;
}

public enum MessageType {
    AUTH,           // 认证
    SCRIPT_LIST,    // 脚本列表
    EXECUTE,        // 执行脚本
    STATUS,         // 状态更新
    HEARTBEAT,      // 心跳
    ERROR           // 错误
}
```

**消息处理器:**
```java
@Controller
@Slf4j
public class WebSocketMessageHandler {
    
    @Autowired
    private ClientService clientService;
    
    @Autowired
    private ScriptService scriptService;
    
    @Autowired
    private ExecutionService executionService;
    
    @MessageMapping("/auth")
    @SendToUser("/queue/auth")
    public ApiResponse handleAuth(@Payload Message message, Principal principal) {
        String username = principal.getName();
        log.info("Auth request from: {}", username);
        
        // 注册客户端
        clientService.registerClient(username, message.getClientId(), message.getData());
        
        return ApiResponse.success("Authentication successful");
    }
    
    @MessageMapping("/script/sync")
    @SendToUser("/queue/script/sync")
    public ApiResponse handleScriptSync(@Payload Message message, Principal principal) {
        String username = principal.getName();
        log.info("Script sync from: {}, client: {}", username, message.getClientId());
        
        // 同步脚本列表
        scriptService.syncScripts(username, message.getClientId(), message.getData());
        
        return ApiResponse.success("Scripts synced successfully");
    }
    
    @MessageMapping("/execution/result")
    public void handleExecutionResult(@Payload Message message, Principal principal) {
        String username = principal.getName();
        log.info("Execution result from: {}, task: {}", username, message.getData().get("taskId"));
        
        // 更新执行结果
        executionService.updateResult(username, message.getData());
    }
}
```

### 2.2 客户端管理功能

#### 2.2.1 客户端注册

**客户端信息:**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientInfo {
    private String clientId;
    private String username;
    private ClientStatus status;
    private LocalDateTime connectedAt;
    private LocalDateTime lastHeartbeat;
    private Map<String, Object> metadata;
    
    public enum ClientStatus {
        ONLINE, OFFLINE
    }
}
```

**客户端服务:**
```java
@Service
@Slf4j
public class ClientService {
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    
    public void registerClient(String username, String clientId, Map<String, Object> data) {
        ClientInfo clientInfo = ClientInfo.builder()
            .clientId(clientId)
            .username(username)
            .status(ClientInfo.ClientStatus.ONLINE)
            .connectedAt(LocalDateTime.now())
            .lastHeartbeat(LocalDateTime.now())
            .metadata(data)
            .build();
        
        clientRegistry.register(username, clientId, clientInfo);
        log.info("Client registered: {} - {}", username, clientId);
    }
    
    public List<ClientInfo> getClients(String username) {
        return clientRegistry.getByUsername(username);
    }
    
    public void disconnectClient(String username, String clientId) {
        clientRegistry.unregister(username, clientId);
        log.info("Client disconnected: {} - {}", username, clientId);
    }
}
```

### 2.3 脚本管理功能

#### 2.3.1 脚本信息存储

**脚本信息（不含code）:**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptInfo {
    private String scriptId;
    private String name;
    private String version;
    private String clientId;
    private String username;
    private LocalDateTime syncedAt;
    private Map<String, Object> metadata;
}
```

**脚本注册表:**
```java
@Component
@Slf4j
public class ScriptRegistry {
    
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, ScriptInfo>> scripts = 
        new ConcurrentHashMap<>();
    
    public void register(String username, String clientId, List<ScriptInfo> scriptList) {
        ConcurrentHashMap<String, ScriptInfo> userScripts = 
            scripts.computeIfAbsent(username, k -> new ConcurrentHashMap<>());
        
        for (ScriptInfo script : scriptList) {
            script.setClientId(clientId);
            script.setUsername(username);
            script.setSyncedAt(LocalDateTime.now());
            userScripts.put(script.getScriptId(), script);
        }
        
        log.info("Registered {} scripts for user: {}, client: {}", 
            scriptList.size(), username, clientId);
    }
    
    public List<ScriptInfo> getScripts(String username) {
        ConcurrentHashMap<String, ScriptInfo> userScripts = scripts.get(username);
        return userScripts == null ? Collections.emptyList() : 
            new ArrayList<>(userScripts.values());
    }
    
    public ScriptInfo getScript(String username, String scriptId) {
        ConcurrentHashMap<String, ScriptInfo> userScripts = scripts.get(username);
        return userScripts == null ? null : userScripts.get(scriptId);
    }
}
```

**脚本服务:**
```java
@Service
@Slf4j
public class ScriptService {
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    public void syncScripts(String username, String clientId, Map<String, Object> data) {
        List<Map<String, Object>> scriptList = (List<Map<String, Object>>) data.get("scripts");
        
        List<ScriptInfo> scripts = scriptList.stream()
            .map(this::mapToScriptInfo)
            .collect(Collectors.toList());
        
        scriptRegistry.register(username, clientId, scripts);
    }
    
    public List<ScriptInfo> getScripts(String username) {
        return scriptRegistry.getScripts(username);
    }
    
    private ScriptInfo mapToScriptInfo(Map<String, Object> map) {
        return ScriptInfo.builder()
            .scriptId((String) map.get("id"))
            .name((String) map.get("name"))
            .version((String) map.get("version"))
            .metadata((Map<String, Object>) map.get("metadata"))
            .build();
    }
}
```

### 2.4 执行管理功能

#### 2.4.1 执行任务管理

**执行任务:**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionTask {
    private String taskId;
    private String scriptId;
    private String username;
    private String clientId;
    private ExecutionStatus status;
    private Map<String, Object> params;
    private Object result;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Long executionTime;
}

public enum ExecutionStatus {
    PENDING,    // 待执行
    RUNNING,    // 执行中
    SUCCESS,    // 成功
    FAILED,     // 失败
    TIMEOUT     // 超时
}
```

**执行注册表:**
```java
@Component
@Slf4j
public class ExecutionRegistry {
    
    private final ConcurrentHashMap<String, ExecutionTask> tasks = new ConcurrentHashMap<>();
    
    public void register(ExecutionTask task) {
        tasks.put(task.getTaskId(), task);
        log.info("Task registered: {}", task.getTaskId());
    }
    
    public ExecutionTask get(String taskId) {
        return tasks.get(taskId);
    }
    
    public void update(String taskId, ExecutionStatus status, Object result, String error) {
        ExecutionTask task = tasks.get(taskId);
        if (task != null) {
            task.setStatus(status);
            task.setResult(result);
            task.setErrorMessage(error);
            task.setCompletedAt(LocalDateTime.now());
            if (task.getStartedAt() != null) {
                task.setExecutionTime(
                    Duration.between(task.getStartedAt(), task.getCompletedAt()).toMillis()
                );
            }
            log.info("Task updated: {}, status: {}", taskId, status);
        }
    }
}
```

**执行服务:**
```java
@Service
@Slf4j
public class ExecutionService {
    
    @Autowired
    private ExecutionRegistry executionRegistry;
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    
    public ExecutionTask executeScript(String username, String scriptId, Map<String, Object> params) {
        ScriptInfo script = scriptRegistry.getScript(username, scriptId);
        if (script == null) {
            throw new BusinessException("Script not found: " + scriptId);
        }
        
        ClientInfo client = clientRegistry.get(username, script.getClientId());
        if (client == null || client.getStatus() != ClientInfo.ClientStatus.ONLINE) {
            throw new BusinessException("Client offline: " + script.getClientId());
        }
        
        ExecutionTask task = ExecutionTask.builder()
            .taskId(generateTaskId())
            .scriptId(scriptId)
            .username(username)
            .clientId(script.getClientId())
            .status(ExecutionStatus.PENDING)
            .params(params)
            .createdAt(LocalDateTime.now())
            .build();
        
        executionRegistry.register(task);
        
        Message message = Message.builder()
            .id(generateMessageId())
            .type(MessageType.EXECUTE)
            .action("script.execute")
            .timestamp(System.currentTimeMillis())
            .username(username)
            .clientId(script.getClientId())
            .data(Map.of(
                "taskId", task.getTaskId(),
                "scriptId", scriptId,
                "params", params
            ))
            .build();
        
        messagingTemplate.convertAndSendToUser(
            username, 
            "/queue/execute", 
            message
        );
        
        log.info("Execution task created: {}, script: {}", task.getTaskId(), scriptId);
        return task;
    }
    
    public void updateResult(String username, Map<String, Object> data) {
        String taskId = (String) data.get("taskId");
        Boolean success = (Boolean) data.get("success");
        Object result = data.get("result");
        String error = (String) data.get("error");
        
        ExecutionStatus status = success ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED;
        executionRegistry.update(taskId, status, result, error);
    }
    
    public ExecutionTask getTask(String taskId) {
        return executionRegistry.get(taskId);
    }
    
    private String generateTaskId() {
        return "task-" + System.currentTimeMillis() + "-" + 
            UUID.randomUUID().toString().substring(0, 8);
    }
    
    private String generateMessageId() {
        return "msg-" + System.currentTimeMillis() + "-" + 
            UUID.randomUUID().toString().substring(0, 8);
    }
}
```

---

## 三、接口与协议设计阶段

### 3.1 WebSocket消息协议（简化版）

#### 3.1.1 消息格式标准

**基础消息结构:**
```json
{
  "id": "msg-123456",
  "type": "EXECUTE",
  "action": "script.execute",
  "timestamp": 1234567890000,
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {
    // 具体数据
  }
}
```

#### 3.1.2 消息类型定义

**1. 认证消息 (AUTH)**
```json
// 客户端 → 服务端
{
  "type": "AUTH",
  "action": "auth.login",
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {
    "version": "1.0.0",
    "platform": "chrome",
    "userAgent": "Mozilla/5.0..."
  }
}

// 服务端 → 客户端
{
  "type": "AUTH",
  "action": "auth.response",
  "data": {
    "success": true,
    "message": "Authentication successful"
  }
}
```

**2. 脚本列表消息 (SCRIPT_LIST)**
```json
// 客户端 → 服务端
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
          "description": "Example script",
          "author": "Developer",
          "match": ["https://example.com/*"],
          "grant": ["GM_xmlhttpRequest"],
          "crontab": "* * once * *",
          "cloudCat": true
        }
      }
    ]
  }
}

// 服务端 → 客户端
{
  "type": "SCRIPT_LIST",
  "action": "script.sync.response",
  "data": {
    "success": true,
    "syncedCount": 1,
    "message": "Scripts synced successfully"
  }
}
```

**3. 执行消息 (EXECUTE)**
```json
// 服务端 → 客户端
{
  "type": "EXECUTE",
  "action": "script.execute",
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {
    "taskId": "task-uuid",
    "scriptId": "script-1",
    "params": {
      "param1": "value1"
    }
  }
}

// 客户端 → 服务端
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

**4. 心跳消息 (HEARTBEAT)**
```json
// 客户端 → 服务端
{
  "type": "HEARTBEAT",
  "action": "ping",
  "username": "user@example.com",
  "clientId": "client-uuid",
  "data": {}
}

// 服务端 → 客户端
{
  "type": "HEARTBEAT",
  "action": "pong",
  "data": {
    "serverTime": 1234567890000
  }
}
```

**5. 错误消息 (ERROR)**
```json
{
  "type": "ERROR",
  "action": "error",
  "data": {
    "code": "CLIENT_NOT_FOUND",
    "message": "Client not found",
    "details": "Client offline or not registered"
  }
}
```

### 3.2 REST API设计（简化版）

#### 3.2.1 客户端管理接口

**获取客户端列表**
```
GET /api/clients?username={username}

Response:
{
  "success": true,
  "data": {
    "clients": [
      {
        "clientId": "client-uuid",
        "username": "user@example.com",
        "status": "ONLINE",
        "connectedAt": "2024-01-01T00:00:00",
        "metadata": {
          "version": "1.0.0",
          "platform": "chrome"
        }
      }
    ]
  }
}
```

#### 3.2.2 脚本管理接口

**获取脚本列表**
```
GET /api/scripts?username={username}

Response:
{
  "success": true,
  "data": {
    "scripts": [
      {
        "scriptId": "script-1",
        "name": "Example Script",
        "version": "1.0.0",
        "clientId": "client-uuid",
        "syncedAt": "2024-01-01T00:00:00"
      }
    ]
  }
}
```

**执行脚本**
```
POST /api/scripts/{scriptId}/execute
Content-Type: application/json

Request:
{
  "username": "user@example.com",
  "params": {
    "param1": "value1"
  }
}

Response:
{
  "success": true,
  "data": {
    "taskId": "task-uuid",
    "scriptId": "script-1",
    "status": "PENDING"
  }
}
```

#### 3.2.3 执行任务接口

**获取任务状态**
```
GET /api/tasks/{taskId}?username={username}

Response:
{
  "success": true,
  "data": {
    "taskId": "task-uuid",
    "scriptId": "script-1",
    "status": "SUCCESS",
    "result": "execution result",
    "executionTime": 1234,
    "createdAt": "2024-01-01T00:00:00",
    "completedAt": "2024-01-01T00:00:01"
  }
}
```

---

## 四、质量保障与测试阶段

### 4.1 单元测试

**客户端服务测试:**
```java
@SpringBootTest
class ClientServiceTest {
    
    @Autowired
    private ClientService clientService;
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @Test
    void shouldRegisterClientSuccessfully() {
        String username = "test@example.com";
        String clientId = "client-123";
        Map<String, Object> data = Map.of("version", "1.0.0");
        
        clientService.registerClient(username, clientId, data);
        
        ClientInfo client = clientRegistry.get(username, clientId);
        assertNotNull(client);
        assertEquals(clientId, client.getClientId());
        assertEquals(ClientInfo.ClientStatus.ONLINE, client.getStatus());
    }
}
```

**执行服务测试:**
```java
@SpringBootTest
class ExecutionServiceTest {
    
    @Autowired
    private ExecutionService executionService;
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @Test
    void shouldCreateExecutionTask() {
        String username = "test@example.com";
        String clientId = "client-123";
        String scriptId = "script-1";
        
        // 准备数据
        clientRegistry.register(username, clientId, 
            ClientInfo.builder()
                .clientId(clientId)
                .username(username)
                .status(ClientInfo.ClientStatus.ONLINE)
                .build()
        );
        
        scriptRegistry.register(username, clientId, 
            List.of(ScriptInfo.builder()
                .scriptId(scriptId)
                .name("Test Script")
                .build())
        );
        
        // 执行测试
        ExecutionTask task = executionService.executeScript(username, scriptId, Map.of());
        
        assertNotNull(task);
        assertEquals(scriptId, task.getScriptId());
        assertEquals(ExecutionStatus.PENDING, task.getStatus());
    }
}
```

### 4.2 集成测试

**WebSocket集成测试:**
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSocketIntegrationTest {
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    private WebSocketStompClient stompClient;
    
    @BeforeEach
    void setup() {
        stompClient = new WebSocketStompClient(new SockJsClient(
            Collections.singletonList(new WebSocketTransport(new StandardWebSocketClient()))
        ));
    }
    
    @Test
    void shouldConnectAndAuthenticate() throws Exception {
        String url = "ws://localhost:" + port + "/ws";
        
        StompHeaders headers = new StompHeaders();
        headers.put("username", Collections.singletonList("test@example.com"));
        
        StompSession session = stompClient.connect(url, headers, new StompSessionHandlerAdapter() {}).get();
        
        assertThat(session.isConnected()).isTrue();
    }
}
```

---

## 五、文档与交付准备阶段

### 5.1 API文档

**WebSocket协议文档:**
```markdown
# WebSocket协议文档

## 连接地址
ws://hostname:8080/ws

## 认证
连接时需要在header中携带:
- username: 用户名（必填）

## 消息格式
...

## 消息类型
...
```

### 5.2 部署文档

**环境要求:**
- JDK 17+
- 2GB+ RAM

**启动命令:**
```bash
java -jar scriptcat-cloud-server.jar
```

**配置文件:**
```yaml
server:
  port: 8080

spring:
  application:
    name: scriptcat-cloud-server

logging:
  level:
    org.scriptcat: DEBUG
```

---

## 六、插件端管理页面开发

### 6.1 管理页面功能

#### 6.1.1 云控管理连接

**页面结构:**
```typescript
// src/pages/options/routes/CloudControl/index.tsx

interface ConnectionState {
  isConnected: boolean;
  serverUrl: string;
  username: string;
  clients: Client[];
}

export function CloudControl() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    serverUrl: 'ws://localhost:8080/ws',
    username: '',
    clients: []
  });
  
  // 组件实现
}
```

#### 6.1.2 功能模块

**1. 连接配置**
```typescript
interface ConnectionConfig {
  serverUrl: string;
  username: string;
  autoReconnect: boolean;
}

function ConnectionConfigForm({ onConnect }: { onConnect: (config: ConnectionConfig) => void }) {
  const [config, setConfig] = useState<ConnectionConfig>({
    serverUrl: 'ws://localhost:8080/ws',
    username: '',
    autoReconnect: true
  });
  
  return (
    <Form layout="vertical">
      <Form.Item label="服务器地址">
        <Input 
          value={config.serverUrl}
          onChange={(e) => setConfig({...config, serverUrl: e.target.value})}
        />
      </Form.Item>
      <Form.Item label="用户名">
        <Input 
          value={config.username}
          onChange={(e) => setConfig({...config, username: e.target.value})}
        />
      </Form.Item>
      <Button type="primary" onClick={() => onConnect(config)}>
        连接
      </Button>
    </Form>
  );
}
```

**2. 客户端列表**
```typescript
function ClientList({ clients }: { clients: Client[] }) {
  return (
    <Table dataSource={clients} rowKey="clientId">
      <Column title="客户端ID" dataIndex="clientId" key="clientId" />
      <Column 
        title="状态" 
        dataIndex="status" 
        key="status"
        render={(status) => (
          <Tag color={status === 'ONLINE' ? 'green' : 'red'}>
            {status}
          </Tag>
        )}
      />
      <Column title="连接时间" dataIndex="connectedAt" key="connectedAt" />
    </Table>
  );
}
```

**3. 脚本管理**
```typescript
function ScriptManagement({ username }: { username: string }) {
  const [scripts, setScripts] = useState<Script[]>([]);
  
  const handleExecute = async (scriptId: string) => {
    try {
      const result = await executeScript(username, scriptId);
      message.success('脚本执行成功');
    } catch (error) {
      message.error('脚本执行失败');
    }
  };
  
  return (
    <Table dataSource={scripts} rowKey="scriptId">
      <Column title="脚本名称" dataIndex="name" key="name" />
      <Column title="版本" dataIndex="version" key="version" />
      <Column 
        title="操作" 
        key="action"
        render={(_, script) => (
          <Button size="small" onClick={() => handleExecute(script.scriptId)}>
            执行
          </Button>
        )}
      />
    </Table>
  );
}
```

### 6.2 WebSocket客户端实现

#### 6.2.1 客户端封装

```typescript
// src/pkg/cloud/WebSocketClient.ts

export class CloudWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;
  
  constructor(private config: ConnectionConfig) {}
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.config.serverUrl);
        
        this.socket.onopen = () => {
          console.log('[CloudWS] Connected to server');
          this.reconnectAttempts = 0;
          this.authenticate();
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };
        
        this.socket.onerror = (error) => {
          console.error('[CloudWS] WebSocket error:', error);
          reject(error);
        };
        
        this.socket.onclose = () => {
          console.log('[CloudWS] Connection closed');
          this.handleDisconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  private authenticate(): void {
    this.send({
      type: 'AUTH',
      action: 'auth.login',
      username: this.config.username,
      clientId: this.getClientId(),
      data: this.getClientInfo()
    });
  }
  
  send(message: Message): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        ...message,
        id: this.generateMessageId(),
        timestamp: Date.now()
      }));
    }
  }
  
  private handleMessage(message: Message): void {
    console.log('[CloudWS] Received message:', message);
    
    switch (message.type) {
      case 'AUTH':
        this.handleAuthResponse(message.data);
        break;
      case 'EXECUTE':
        this.handleExecuteRequest(message.data);
        break;
      case 'HEARTBEAT':
        this.handleHeartbeat(message.data);
        break;
    }
  }
  
  private async handleExecuteRequest(data: ExecuteMessage): Promise<void> {
    try {
      // 从本地获取脚本并执行
      const script = await this.getLocalScript(data.scriptId);
      const result = await this.executeScript(script.code, data.params);
      
      this.send({
        type: 'EXECUTE',
        action: 'script.result',
        username: this.config.username,
        clientId: this.getClientId(),
        data: {
          taskId: data.taskId,
          success: true,
          result: result,
          executionTime: Date.now() - data.timestamp
        }
      });
    } catch (error) {
      this.send({
        type: 'EXECUTE',
        action: 'script.result',
        username: this.config.username,
        clientId: this.getClientId(),
        data: {
          taskId: data.taskId,
          success: false,
          error: error.message,
          executionTime: Date.now() - data.timestamp
        }
      });
    }
  }
  
  private async getLocalScript(scriptId: string): Promise<Script> {
    // 从本地存储获取脚本
    const scripts = await getLocalScripts();
    const script = scripts.find(s => s.id === scriptId);
    if (!script) {
      throw new Error(`Script not found: ${scriptId}`);
    }
    return script;
  }
  
  private syncScripts(): void {
    getLocalScripts().then(scripts => {
      this.send({
        type: 'SCRIPT_LIST',
        action: 'script.sync',
        username: this.config.username,
        clientId: this.getClientId(),
        data: {
          scripts: scripts.map(s => ({
            id: s.id,
            name: s.name,
            version: s.version,
            metadata: s.metadata
          }))
        }
      });
    });
  }
}
```

---

## 七、开发时间估算

### 7.1 各阶段时间估算

| 阶段 | 任务 | 预计时间 | 优先级 |
|------|------|----------|--------|
| **阶段一: 项目规划与准备** | | **1天** | 高 |
| | 项目结构创建 | 0.5天 | 高 |
| | 基础配置 | 0.5天 | 高 |
| **阶段二: 核心功能开发** | | **5天** | 高 |
| | WebSocket服务实现 | 2天 | 高 |
| | 客户端管理 | 1天 | 高 |
| | 脚本管理 | 1天 | 高 |
| | 执行管理 | 1天 | 高 |
| **阶段三: 接口与协议设计** | | **1天** | 高 |
| | WebSocket协议实现 | 0.5天 | 高 |
| | REST API实现 | 0.5天 | 高 |
| **阶段四: 质量保障与测试** | | **2天** | 中 |
| | 单元测试 | 1天 | 中 |
| | 集成测试 | 1天 | 中 |
| **阶段五: 文档与交付** | | **1天** | 中 |
| | API文档编写 | 0.5天 | 中 |
| | 部署文档编写 | 0.5天 | 中 |
| **阶段六: 插件端管理页面** | | **3天** | 高 |
| | 管理页面UI开发 | 1.5天 | 高 |
| | WebSocket客户端实现 | 1天 | 高 |
| | 与服务端集成测试 | 0.5天 | 高 |
| **总计** | | **13天** | |

### 7.2 里程碑计划

- **第1天**: 完成项目规划和基础架构
- **第6天**: 完成核心功能开发
- **第8天**: 完成接口设计和测试
- **第13天**: 完成插件端集成，交付可用版本

---

## 八、技术难点与解决方案

### 8.1 内存管理

**难点:**
- 大量数据的内存占用
- 数据清理策略

**解决方案:**
1. 使用ConcurrentHashMap保证线程安全
2. 实现定期清理过期数据
3. 监控内存使用情况

### 8.2 连接管理

**难点:**
- 大量并发连接
- 异常断线检测

**解决方案:**
1. 使用心跳检测机制
2. 实现自动重连
3. 连接池管理

### 8.3 数据隔离

**难点:**
- 多用户数据隔离
- 查询效率

**解决方案:**
1. 使用username作为key前缀
2. 合理设计Map结构
3. 提供便捷的查询方法

---

## 九、后续优化方向

### 9.1 功能增强
- 支持数据库持久化
- 实现集群部署
- 添加用户认证
- 支持脚本版本管理

### 9.2 性能优化
- 引入缓存机制
- 实现数据分片
- 优化查询性能

### 9.3 安全增强
- 实现完整的认证授权
- 添加API限流
- 实现审计日志

---

## 附录

### A. 配置文件示例

**application.yml:**
```yaml
server:
  port: 8080

spring:
  application:
    name: scriptcat-cloud-server

logging:
  level:
    org.scriptcat: DEBUG
    org.springframework.web: INFO
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"

app:
  websocket:
    heartbeat-interval: 30000
    connection-timeout: 90000
  execution:
    timeout: 30000
```

---

**文档版本**: v1.0 (MVP)  
**创建日期**: 2024-01-01  
**最后更新**: 2024-01-01  
**维护者**: ScriptCat Team
