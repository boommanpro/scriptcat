package org.scriptcat.cloudserver.user.service;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.user.model.UserSession;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class UserSessionRegistry {
    
    private final ConcurrentHashMap<String, UserSession> users = new ConcurrentHashMap<>();
    
    public void register(String username, UserSession session) {
        users.put(username, session);
        log.info("User registered: {}", username);
    }
    
    public void unregister(String username) {
        users.remove(username);
        log.info("User unregistered: {}", username);
    }
    
    public UserSession get(String username) {
        return users.get(username);
    }
    
    public boolean exists(String username) {
        return users.containsKey(username);
    }
}
