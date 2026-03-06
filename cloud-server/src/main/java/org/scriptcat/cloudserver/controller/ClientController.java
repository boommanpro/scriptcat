package org.scriptcat.cloudserver.controller;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.scriptcat.cloudserver.client.service.ClientRegistry;
import org.scriptcat.cloudserver.client.service.ClientService;
import org.scriptcat.cloudserver.common.response.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/clients")
public class ClientController {
    
    @Autowired
    private ClientService clientService;
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @GetMapping
    public ApiResponse<Map<String, Object>> getClients(@RequestParam String username) {
        List<ClientInfo> clients = clientService.getClients(username);
        
        Map<String, Object> result = new HashMap<>();
        result.put("clients", clients);
        result.put("total", clients.size());
        
        return ApiResponse.success(result);
    }
    
    @GetMapping("/all")
    public ApiResponse<Map<String, Object>> getAllClients() {
        List<ClientInfo> clients = clientRegistry.getAllOnline();
        
        Map<String, Object> result = new HashMap<>();
        result.put("clients", clients);
        result.put("total", clients.size());
        
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
