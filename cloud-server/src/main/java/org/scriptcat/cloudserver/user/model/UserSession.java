package org.scriptcat.cloudserver.user.model;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Data
@AllArgsConstructor
public class UserSession {
    
    private String username;
    private LocalDateTime createdAt;
    private Set<String> clientIds;
    
    public UserSession(String username) {
        this.username = username;
        this.createdAt = LocalDateTime.now();
        this.clientIds = ConcurrentHashMap.newKeySet();
    }
}
