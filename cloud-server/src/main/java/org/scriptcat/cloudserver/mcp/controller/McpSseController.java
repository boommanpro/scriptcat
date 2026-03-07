package org.scriptcat.cloudserver.mcp.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.mcp.config.McpAuthInterceptor;
import org.scriptcat.cloudserver.mcp.service.McpToolExecutionService;
import org.scriptcat.cloudserver.mcp.service.McpToolRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
public class McpSseController {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConcurrentHashMap<String, String> sessionToUser = new ConcurrentHashMap<>();

    @Autowired
    private McpToolRegistry toolRegistry;

    @Autowired
    private McpToolExecutionService executionService;



    @PostMapping(value = "/mcp/message", consumes = MediaType.APPLICATION_JSON_VALUE)
    public void handleMessage(
            HttpServletRequest request,
            HttpServletResponse response,
            @RequestBody Map<String, Object> message,
            @RequestParam(required = false) String sessionId) throws IOException {

        String username = McpAuthInterceptor.getUsername(request);
        if (username == null) {
            sendErrorResponse(response, "Unauthorized");
            return;
        }

        if (sessionId == null) {
            sessionId = findSessionIdByUsername(username);
        }

        log.debug("Received MCP message: {} for user: {}", message.get("method"), username);

        String method = (String) message.get("method");
        Object id = message.get("id");

        try {
            Object result = handleMcpMethod(username, method, message);
            // Don't send response for notifications (no id)
            if (id != null) {
                sendSuccessResponse(response, id, result);
            } else {
                log.trace("Notification processed, no response sent: {}", method);
            }
        } catch (Exception e) {
            log.error("Error handling MCP method {}: {}", method, e.getMessage(), e);
            // Only send error response if there's an id (not for notifications)
            if (id != null) {
                sendErrorResponse(response, id, e.getMessage());
            }
        }
    }

    private Object handleMcpMethod(String username, String method, Map<String, Object> message) {
        switch (method) {
            case "initialize":
                return handleInitialize(username, message);
            case "tools/list":
                return handleToolsList(username);
            case "tools/call":
                return handleToolsCall(username, message);
            case "ping":
                return new HashMap<String, Object>();
            case "notifications/cancelled":
                // Handle cancellation notification - no response needed
                log.debug("Received cancellation notification: {}", message.get("params"));
                return null;
            default:
                // Check if it's a notification method (starts with "notifications/")
                if (method != null && method.startsWith("notifications/")) {
                    log.debug("Received notification: {}", method);
                    return null; // Notifications don't require a response
                }
                throw new IllegalArgumentException("Unknown method: " + method);
        }
    }

    private Object handleInitialize(String username, Map<String, Object> message) {
        Map<String, Object> result = new HashMap<>();
        result.put("protocolVersion", "2024-11-05");
        result.put("capabilities", Map.of(
            "tools", Map.of("listChanged", true),
            "resources", Map.of("subscribe", false, "listChanged", false),
            "prompts", Map.of("listChanged", false)
        ));
        result.put("serverInfo", Map.of(
            "name", "scriptcat-mcp-server",
            "version", "1.0.0"
        ));
        return result;
    }

    private Object handleToolsList(String username) {
        List<McpSchema.Tool> tools = toolRegistry.getTools(username);
        return Map.of("tools", tools);
    }

    private Object handleToolsCall(String username, Map<String, Object> message) {
        @SuppressWarnings("unchecked")
        Map<String, Object> params = (Map<String, Object>) message.get("params");
        if (params == null) {
            throw new IllegalArgumentException("Missing params");
        }

        String toolName = (String) params.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Object> arguments = (Map<String, Object>) params.get("arguments");

        if (toolName == null) {
            throw new IllegalArgumentException("Missing tool name");
        }

        log.info("Calling tool: {} for user: {} with arguments: {}", toolName, username, arguments);

        McpSchema.CallToolResult result = executionService.executeTool(username, toolName, arguments);

        return Map.of(
            "content", result.content(),
            "isError", result.isError()
        );
    }

    private void sendSuccessResponse(HttpServletResponse response, Object id, Object result) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("jsonrpc", "2.0");
        responseMap.put("id", id);
        responseMap.put("result", result);
        response.getWriter().write(objectMapper.writeValueAsString(responseMap));
    }

    private void sendErrorResponse(HttpServletResponse response, Object id, String errorMessage) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("jsonrpc", "2.0");
        responseMap.put("id", id);
        responseMap.put("error", Map.of(
            "code", -32603,
            "message", errorMessage
        ));
        response.getWriter().write(objectMapper.writeValueAsString(responseMap));
    }

    private void sendErrorResponse(HttpServletResponse response, String errorMessage) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("error", errorMessage);
        response.getWriter().write(objectMapper.writeValueAsString(responseMap));
    }

    private String findSessionIdByUsername(String username) {
        for (Map.Entry<String, String> entry : sessionToUser.entrySet()) {
            if (entry.getValue().equals(username)) {
                return entry.getKey();
            }
        }
        return null;
    }
}
