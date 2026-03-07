package org.scriptcat.cloudserver.mcp.config;

import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.mcp.service.McpToolRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Configuration
public class McpToolConfiguration {
    
    @Autowired(required = false)
    private McpSyncServer mcpSyncServer;
    
    @Autowired
    private McpToolRegistry toolRegistry;
    
    private final Map<String, McpSchema.Tool> registeredTools = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void init() {
        log.info("MCP Tool Configuration initialized");
    }
    
    public void registerToolForUser(String username, String toolName, String description, String inputSchema) {
        McpSchema.Tool tool = new McpSchema.Tool(toolName, description, inputSchema);
        String key = username + ":" + toolName;
        registeredTools.put(key, tool);
        log.info("Registered tool: {} for user: {}", toolName, username);
    }
    
    public void unregisterToolForUser(String username, String toolName) {
        String key = username + ":" + toolName;
        registeredTools.remove(key);
        log.info("Unregistered tool: {} for user: {}", toolName, username);
    }
    
    public List<McpSchema.Tool> getAllRegisteredTools() {
        return new ArrayList<>(registeredTools.values());
    }
}
