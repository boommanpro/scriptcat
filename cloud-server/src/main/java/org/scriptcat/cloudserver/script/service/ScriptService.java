package org.scriptcat.cloudserver.script.service;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.controller.ManagementWebSocketController;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ScriptService {
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    @Autowired
    private ManagementWebSocketController managementController;
    
    public void syncScripts(String username, String clientId, Map<String, Object> data) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> scriptList = (List<Map<String, Object>>) data.get("scripts");
        
        List<ScriptInfo> scripts = scriptList.stream()
            .map(this::mapToScriptInfo)
            .collect(Collectors.toList());
        
        scriptRegistry.register(username, clientId, scripts);
        managementController.notifyScriptSynced(username, clientId, scripts.size());
    }
    
    public List<ScriptInfo> getScripts(String username) {
        return scriptRegistry.getScripts(username);
    }
    
    public ScriptInfo getScript(String username, String scriptId) {
        return scriptRegistry.getScript(username, scriptId);
    }
    
    @SuppressWarnings("unchecked")
    private ScriptInfo mapToScriptInfo(Map<String, Object> map) {
        return ScriptInfo.builder()
            .scriptId((String) map.get("id"))
            .name((String) map.get("name"))
            .version((String) map.get("version"))
            .metadata((Map<String, Object>) map.get("metadata"))
            .build();
    }
}
