package org.scriptcat.cloudserver.mcp.listener;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.mcp.service.McpToolRegistry;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.scriptcat.cloudserver.script.service.ScriptRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
public class ScriptSyncEventListener {
    
    @Autowired
    private McpToolRegistry toolRegistry;
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    @EventListener
    public void onScriptSync(ScriptSyncEvent event) {
        String username = event.getUsername();
        String clientId = event.getClientId();
        
        log.info("Processing script sync event for user: {}, client: {}", username, clientId);
        
        List<ScriptInfo> scripts = scriptRegistry.getScripts(username);
        toolRegistry.syncTools(username, scripts);
        
        log.info("MCP tools synced for user: {}, count: {}", username, scripts.size());
    }
    
    public static class ScriptSyncEvent {
        private final String username;
        private final String clientId;
        
        public ScriptSyncEvent(String username, String clientId) {
            this.username = username;
            this.clientId = clientId;
        }
        
        public String getUsername() {
            return username;
        }
        
        public String getClientId() {
            return clientId;
        }
    }
}
