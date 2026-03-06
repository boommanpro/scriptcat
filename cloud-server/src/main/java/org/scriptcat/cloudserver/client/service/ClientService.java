package org.scriptcat.cloudserver.client.service;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.scriptcat.cloudserver.controller.ManagementWebSocketController;
import org.scriptcat.cloudserver.script.service.ScriptRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ClientService {
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    @Autowired
    private ManagementWebSocketController managementController;
    
    public void registerClient(String username, String clientId, Map<String, Object> data) {
        ClientInfo clientInfo = ClientInfo.builder()
            .clientId(clientId)
            .username(username)
            .status(ClientInfo.ClientStatus.ONLINE)
            .connectedAt(LocalDateTime.now())
            .lastHeartbeat(LocalDateTime.now())
            .metadata(data)
            .build();
        
        clientRegistry.register(username, clientId, clientInfo);
        managementController.notifyClientConnected(clientInfo);
        log.info("Client registered: {} - {}", username, clientId);
    }
    
    public List<ClientInfo> getClients(String username) {
        return clientRegistry.getByUsername(username);
    }
    
    public void disconnectClient(String username, String clientId) {
        clientRegistry.unregister(username, clientId);
        scriptRegistry.removeByClientId(username, clientId);
        managementController.notifyClientDisconnected(username, clientId);
        log.info("Client disconnected: {} - {}", username, clientId);
    }
    
    public void updateHeartbeat(String username, String clientId) {
        clientRegistry.updateHeartbeat(username, clientId);
    }
}
