package org.scriptcat.cloudserver.mcp.service;

import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.mcp.config.McpAuthInterceptor;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.scriptcat.cloudserver.script.service.ScriptRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class McpDynamicToolProvider {
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    @Autowired
    private McpToolRegistry toolRegistry;
    
    private final ConcurrentHashMap<String, McpSchema.Tool> staticTools = new ConcurrentHashMap<>();
    
    public List<McpSchema.Tool> getToolsForCurrentUser() {
        String username = getCurrentUsername();
        if (username == null) {
            return new ArrayList<>();
        }
        return toolRegistry.getTools(username);
    }
    
    public McpSchema.CallToolResult executeToolForCurrentUser(String toolName, Map<String, Object> arguments) {
        String username = getCurrentUsername();
        if (username == null) {
            return createErrorResult("Not authenticated");
        }
        
        String scriptId = toolRegistry.getScriptIdByToolName(username, toolName);
        if (scriptId == null) {
            return createErrorResult("Tool not found: " + toolName);
        }
        
        return null;
    }
    
    public void syncToolsFromScripts(String username) {
        List<ScriptInfo> scripts = scriptRegistry.getScripts(username);
        toolRegistry.syncTools(username, scripts);
        log.info("Synced {} tools for user: {}", scripts.size(), username);
    }
    
    private String getCurrentUsername() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) {
            return null;
        }
        HttpServletRequest request = attrs.getRequest();
        return McpAuthInterceptor.getUsername(request);
    }
    
    private McpSchema.CallToolResult createErrorResult(String message) {
        return new McpSchema.CallToolResult(
            List.of(new McpSchema.TextContent("Error: " + message)),
            true
        );
    }
}
