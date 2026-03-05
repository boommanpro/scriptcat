package org.scriptcat.cloudserver.client.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientInfo {
    
    private String clientId;
    private String username;
    private ClientStatus status;
    private LocalDateTime connectedAt;
    private LocalDateTime lastHeartbeat;
    private Map<String, Object> metadata;
    
    public enum ClientStatus {
        ONLINE, OFFLINE
    }
}
