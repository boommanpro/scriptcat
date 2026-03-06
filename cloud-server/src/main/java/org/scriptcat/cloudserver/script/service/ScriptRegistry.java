package org.scriptcat.cloudserver.script.service;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Component
public class ScriptRegistry {
    
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, ScriptInfo>> scripts = 
        new ConcurrentHashMap<>();
    
    public void register(String username, String clientId, List<ScriptInfo> scriptList) {
        ConcurrentHashMap<String, ScriptInfo> userScripts = 
            scripts.computeIfAbsent(username, k -> new ConcurrentHashMap<>());
        
        for (ScriptInfo script : scriptList) {
            script.setClientId(clientId);
            script.setUsername(username);
            script.setSyncedAt(java.time.LocalDateTime.now());
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
    
    public void removeByClientId(String username, String clientId) {
        ConcurrentHashMap<String, ScriptInfo> userScripts = scripts.get(username);
        if (userScripts != null) {
            userScripts.entrySet().removeIf(entry -> 
                clientId.equals(entry.getValue().getClientId()));
            log.info("Removed scripts for client: {} - {}", username, clientId);
        }
    }
    
    public ConcurrentHashMap<String, ConcurrentHashMap<String, ScriptInfo>> getAllScripts() {
        return scripts;
    }
    
    public int getScriptCountByClient(String username, String clientId) {
        ConcurrentHashMap<String, ScriptInfo> userScripts = scripts.get(username);
        if (userScripts == null) {
            return 0;
        }
        return (int) userScripts.values().stream()
            .filter(script -> clientId.equals(script.getClientId()))
            .count();
    }
}
