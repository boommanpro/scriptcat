package org.scriptcat.cloudserver.mcp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpSchema;
import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.scriptcat.cloudserver.client.service.ClientRegistry;
import org.scriptcat.cloudserver.common.exception.BusinessException;
import org.scriptcat.cloudserver.common.util.IdGenerator;
import org.scriptcat.cloudserver.execution.model.ExecutionStatus;
import org.scriptcat.cloudserver.execution.model.ExecutionTask;
import org.scriptcat.cloudserver.execution.service.ExecutionRegistry;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.scriptcat.cloudserver.script.service.ScriptRegistry;
import org.scriptcat.cloudserver.websocket.handler.RawWebSocketHandler;
import org.scriptcat.cloudserver.websocket.message.Message;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class McpToolExecutionService {

    @Value("${app.execution.timeout:30000}")
    private long executionTimeout;

    @Autowired
    private McpToolRegistry toolRegistry;

    @Autowired
    private ScriptRegistry scriptRegistry;

    @Autowired
    private ClientRegistry clientRegistry;

    @Autowired
    private ExecutionRegistry executionRegistry;

    @Autowired
    @Lazy
    private RawWebSocketHandler webSocketHandler;

    @Autowired
    private ObjectMapper objectMapper;

    private final ConcurrentHashMap<String, CompletableFuture<McpSchema.CallToolResult>> pendingExecutions =
        new ConcurrentHashMap<>();

    public McpSchema.CallToolResult executeTool(String username, String toolName, Map<String, Object> arguments) {
        String scriptId = toolRegistry.getScriptIdByToolName(username, toolName);
        if (scriptId == null) {
            return createErrorResult("Tool not found: " + toolName);
        }

        ScriptInfo script = scriptRegistry.getScript(username, scriptId);
        if (script == null) {
            return createErrorResult("Script not found: " + scriptId);
        }

        ClientInfo client = clientRegistry.get(username, script.getClientId());
        if (client == null || client.getStatus() != ClientInfo.ClientStatus.ONLINE) {
            return createErrorResult("Client offline for script: " + script.getName());
        }

        ExecutionTask task = createExecutionTask(username, scriptId, script.getClientId(), arguments);

        CompletableFuture<McpSchema.CallToolResult> future = new CompletableFuture<>();
        pendingExecutions.put(task.getTaskId(), future);

        try {
            sendExecutionMessage(username, script.getClientId(), task);
            log.info("MCP tool execution started: user={}, tool={}, taskId={}", username, toolName, task.getTaskId());
        } catch (Exception e) {
            pendingExecutions.remove(task.getTaskId());
            log.error("Failed to send execution message: {}", e.getMessage(), e);
            return createErrorResult("Failed to execute tool: " + e.getMessage());
        }

        try {
            return future.get(executionTimeout, TimeUnit.MILLISECONDS);
        } catch (java.util.concurrent.TimeoutException e) {
            pendingExecutions.remove(task.getTaskId());
            executionRegistry.updateStatus(task.getTaskId(), ExecutionStatus.TIMEOUT);
            log.warn("MCP tool execution timeout: taskId={}", task.getTaskId());
            return createErrorResult("Tool execution timeout");
        } catch (Exception e) {
            pendingExecutions.remove(task.getTaskId());
            log.error("MCP tool execution error: {}", e.getMessage(), e);
            return createErrorResult("Tool execution error: " + e.getMessage());
        }
    }

    private ExecutionTask createExecutionTask(String username, String scriptId, String clientId, Map<String, Object> params) {
        ExecutionTask task = ExecutionTask.builder()
            .taskId(IdGenerator.generateTaskId())
            .scriptId(scriptId)
            .username(username)
            .clientId(clientId)
            .status(ExecutionStatus.PENDING)
            .params(params)
            .createdAt(LocalDateTime.now())
            .build();

        executionRegistry.register(task);
        return task;
    }

    private void sendExecutionMessage(String username, String clientId, ExecutionTask task) throws Exception {
        Message message = Message.builder()
            .id(IdGenerator.generateMessageId())
            .type("EXECUTE")
            .action("script.execute")
            .timestamp(System.currentTimeMillis())
            .username(username)
            .clientId(clientId)
            .data(Map.of(
                "taskId", task.getTaskId(),
                "scriptId", task.getScriptId(),
                "params", task.getParams() != null ? task.getParams() : Map.of()
            ))
            .build();

        webSocketHandler.sendMessageToClient(username, clientId, message);
    }

    public void handleExecutionResult(String taskId, boolean success, Object result, String error) {
        CompletableFuture<McpSchema.CallToolResult> future = pendingExecutions.remove(taskId);
        if (future == null) {
            log.warn("No pending execution found for taskId: {}", taskId);
            return;
        }

        ExecutionStatus status = success ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED;
        executionRegistry.update(taskId, status, result, error);

        McpSchema.CallToolResult toolResult;
        if (success) {
            String resultText = result != null ? String.valueOf(result) : "Execution completed successfully";
            toolResult = new McpSchema.CallToolResult(
                List.of(new McpSchema.TextContent(resultText)),
                false
            );
        } else {
            toolResult = createErrorResult(error != null ? error : "Execution failed");
        }

        future.complete(toolResult);
        log.info("MCP tool execution completed: taskId={}, success={}", taskId, success);
    }

    private McpSchema.CallToolResult createErrorResult(String errorMessage) {
        return new McpSchema.CallToolResult(
            List.of(new McpSchema.TextContent("Error: " + errorMessage)),
            true
        );
    }

    public List<McpSchema.Tool> getToolsForUser(String username) {
        return toolRegistry.getTools(username);
    }

    public void registerScriptAsTool(String username, ScriptInfo script) {
        toolRegistry.registerTool(username, script);
    }

    public void unregisterScriptTool(String username, String scriptId) {
        toolRegistry.unregisterTool(username, scriptId);
    }
}
