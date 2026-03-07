package org.scriptcat.cloudserver.mcp.service;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.modelcontextprotocol.spec.McpSchema;
import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class McpToolRegistry {
    
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, McpSchema.Tool>> userTools = 
        new ConcurrentHashMap<>();
    
    private final ConcurrentHashMap<String, McpSchema.CallToolResult> pendingResults = 
        new ConcurrentHashMap<>();
    
    public void registerTool(String username, ScriptInfo script) {
        ConcurrentHashMap<String, McpSchema.Tool> tools = 
            userTools.computeIfAbsent(username, k -> new ConcurrentHashMap<>());
        
        McpSchema.Tool tool = createToolFromScript(script);
        tools.put(script.getScriptId(), tool);
        log.info("Registered MCP tool for user {}: {}", username, tool.name());
    }
    
    public void unregisterTool(String username, String scriptId) {
        ConcurrentHashMap<String, McpSchema.Tool> tools = userTools.get(username);
        if (tools != null) {
            tools.remove(scriptId);
            log.info("Unregistered MCP tool for user {}: {}", username, scriptId);
        }
    }
    
    public void unregisterAllTools(String username) {
        userTools.remove(username);
        log.info("Unregistered all MCP tools for user: {}", username);
    }
    
    public List<McpSchema.Tool> getTools(String username) {
        ConcurrentHashMap<String, McpSchema.Tool> tools = userTools.get(username);
        return tools == null ? Collections.emptyList() : new ArrayList<>(tools.values());
    }
    
    public McpSchema.Tool getTool(String username, String toolName) {
        ConcurrentHashMap<String, McpSchema.Tool> tools = userTools.get(username);
        if (tools == null) {
            return null;
        }
        for (McpSchema.Tool tool : tools.values()) {
            if (tool.name().equals(toolName)) {
                return tool;
            }
        }
        return null;
    }
    
    public String getScriptIdByToolName(String username, String toolName) {
        ConcurrentHashMap<String, McpSchema.Tool> tools = userTools.get(username);
        if (tools == null) {
            return null;
        }
        for (Map.Entry<String, McpSchema.Tool> entry : tools.entrySet()) {
            if (entry.getValue().name().equals(toolName)) {
                return entry.getKey();
            }
        }
        return null;
    }
    
    public void syncTools(String username, List<ScriptInfo> scripts) {
        ConcurrentHashMap<String, McpSchema.Tool> newTools = new ConcurrentHashMap<>();
        for (ScriptInfo script : scripts) {
            McpSchema.Tool tool = createToolFromScript(script);
            newTools.put(script.getScriptId(), tool);
        }
        userTools.put(username, newTools);
        log.info("Synced {} MCP tools for user: {}", scripts.size(), username);
    }
    
    private McpSchema.Tool createToolFromScript(ScriptInfo script) {
        String toolName = sanitizeToolName(script.getName(), script.getScriptId());
        String description = script.getMetadata() != null && script.getMetadata().containsKey("description") 
            ? String.valueOf(script.getMetadata().get("description")) 
            : "Execute script: " + script.getName();
        
        String inputSchema = createInputSchemaJson(script);
        
        return new McpSchema.Tool(toolName, description, inputSchema);
    }
    
    private String sanitizeToolName(String name, String scriptId) {
        if (name == null || name.isEmpty()) {
            return "script_" + scriptId.replaceAll("[^a-zA-Z0-9_]", "_");
        }
        String sanitized = name.toLowerCase()
            .replaceAll("[^a-z0-9_]", "_")
            .replaceAll("_{2,}", "_")
            .replaceAll("^_|_$", "");
        if (sanitized.isEmpty()) {
            return "script_" + scriptId.replaceAll("[^a-zA-Z0-9_]", "_");
        }
        return sanitized;
    }
    
    private String createInputSchemaJson(ScriptInfo script) {
        ObjectNode schemaNode = JsonNodeFactory.instance.objectNode();
        schemaNode.put("type", "object");
        
        ObjectNode propertiesNode = schemaNode.putObject("properties");
        
        if (script.getMetadata() != null && script.getMetadata().containsKey("parameters")) {
            Object params = script.getMetadata().get("parameters");
            if (params instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> paramsMap = (Map<String, Object>) params;
                
                if (paramsMap.containsKey("properties")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> props = (Map<String, Object>) paramsMap.get("properties");
                    for (Map.Entry<String, Object> prop : props.entrySet()) {
                        if (prop.getValue() instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> propDef = (Map<String, Object>) prop.getValue();
                            ObjectNode propNode = propertiesNode.putObject(prop.getKey());
                            for (Map.Entry<String, Object> attr : propDef.entrySet()) {
                                setPropertyNode(propNode, attr.getKey(), attr.getValue());
                            }
                        }
                    }
                }
                
                if (paramsMap.containsKey("required")) {
                    Object reqObj = paramsMap.get("required");
                    if (reqObj instanceof List) {
                        @SuppressWarnings("unchecked")
                        List<String> reqList = (List<String>) reqObj;
                        schemaNode.putArray("required").addAll(
                            reqList.stream()
                                .map(JsonNodeFactory.instance::textNode)
                                .collect(java.util.stream.Collectors.toList())
                        );
                    }
                }
            }
        }
        
        return schemaNode.toString();
    }
    
    private void setPropertyNode(ObjectNode node, String key, Object value) {
        if (value == null) return;
        
        switch (key) {
            case "type":
                node.put("type", String.valueOf(value));
                break;
            case "description":
                node.put("description", String.valueOf(value));
                break;
            case "default":
                if (value instanceof String) {
                    node.put("default", (String) value);
                } else if (value instanceof Number) {
                    node.put("default", ((Number) value).doubleValue());
                } else if (value instanceof Boolean) {
                    node.put("default", (Boolean) value);
                }
                break;
            case "enum":
                if (value instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<?> enumList = (List<?>) value;
                    node.putArray("enum").addAll(
                        enumList.stream()
                            .map(v -> JsonNodeFactory.instance.textNode(String.valueOf(v)))
                            .collect(java.util.stream.Collectors.toList())
                    );
                }
                break;
            default:
                break;
        }
    }
    
    public void storeExecutionResult(String taskId, McpSchema.CallToolResult result) {
        pendingResults.put(taskId, result);
        log.debug("Stored execution result for task: {}", taskId);
    }
    
    public McpSchema.CallToolResult getExecutionResult(String taskId) {
        return pendingResults.remove(taskId);
    }
    
    public void removeExecutionResult(String taskId) {
        pendingResults.remove(taskId);
    }
    
    public boolean hasUser(String username) {
        return userTools.containsKey(username);
    }
}
