package org.scriptcat.cloudserver.controller;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.scriptcat.cloudserver.client.service.ClientRegistry;
import org.scriptcat.cloudserver.client.service.ClientService;
import org.scriptcat.cloudserver.common.response.ApiResponse;
import org.scriptcat.cloudserver.script.service.ScriptRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/clients")
public class ClientController {
    
    @Autowired
    private ClientService clientService;
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    @GetMapping
    public ApiResponse<Map<String, Object>> getClients(@RequestParam String username) {
        List<ClientInfo> clients = clientService.getClients(username);
        List<ClientInfo> clientsWithScriptCount = clients.stream()
            .map(client -> {
                client.setScriptCount(scriptRegistry.getScriptCountByClient(client.getUsername(), client.getClientId()));
                return client;
            })
            .collect(Collectors.toList());
        
        Map<String, Object> result = new HashMap<>();
        result.put("clients", clientsWithScriptCount);
        result.put("total", clientsWithScriptCount.size());
        
        return ApiResponse.success(result);
    }
    
    @GetMapping("/all")
    public ApiResponse<Map<String, Object>> getAllClients() {
        List<ClientInfo> clients = clientRegistry.getAllOnline();
        List<ClientInfo> clientsWithScriptCount = clients.stream()
            .map(client -> {
                client.setScriptCount(scriptRegistry.getScriptCountByClient(client.getUsername(), client.getClientId()));
                return client;
            })
            .collect(Collectors.toList());
        
        Map<String, Object> result = new HashMap<>();
        result.put("clients", clientsWithScriptCount);
        result.put("total", clientsWithScriptCount.size());
        
        return ApiResponse.success(result);
    }
    
    @PostMapping("/{clientId}/disconnect")
    public ApiResponse<Map<String, Object>> disconnectClient(
            @PathVariable String clientId,
            @RequestParam String username) {
        
        if (username == null || username.isEmpty()) {
            return ApiResponse.error("Username is required");
        }
        
        clientService.disconnectClient(username, clientId);
        
        Map<String, Object> result = new HashMap<>();
        result.put("clientId", clientId);
        result.put("status", "disconnected");
        
        return ApiResponse.success(result);
    }
}
