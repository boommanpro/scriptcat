package org.scriptcat.cloudserver.controller;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
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
    
    @GetMapping
    public ApiResponse<Map<String, Object>> getClients(@RequestParam String username) {
        List<ClientInfo> clients = clientService.getClients(username);
        
        Map<String, Object> result = new HashMap<>();
        result.put("clients", clients);
        result.put("total", clients.size());
        
        return ApiResponse.success(result);
    }
}
