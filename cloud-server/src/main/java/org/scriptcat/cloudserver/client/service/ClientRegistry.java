package org.scriptcat.cloudserver.client.service;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Component
public class ClientRegistry {
    
    private final ConcurrentHashMap<String, ClientInfo> clients = new ConcurrentHashMap<>();
    
    public void register(String username, String clientId, ClientInfo clientInfo) {
        String key = buildKey(username, clientId);
        clients.put(key, clientInfo);
        log.info("Client registered: {}", key);
    }
    
    public void unregister(String username, String clientId) {
        String key = buildKey(username, clientId);
        clients.remove(key);
        log.info("Client unregistered: {}", key);
    }
    
    public ClientInfo get(String username, String clientId) {
        return clients.get(buildKey(username, clientId));
    }
    
    public List<ClientInfo> getByUsername(String username) {
        return clients.entrySet().stream()
            .filter(e -> e.getKey().startsWith(username + ":"))
            .map(e -> e.getValue())
            .collect(Collectors.toList());
    }
    
    public List<ClientInfo> getAllOnline() {
        return new ArrayList<>(clients.values());
    }
    
    public void updateHeartbeat(String username, String clientId) {
        ClientInfo client = get(username, clientId);
        if (client != null) {
            client.setLastHeartbeat(java.time.LocalDateTime.now());
        }
    }
    
    private String buildKey(String username, String clientId) {
        return username + ":" + clientId;
    }
}
