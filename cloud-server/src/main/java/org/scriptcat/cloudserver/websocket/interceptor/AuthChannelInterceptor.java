package org.scriptcat.cloudserver.websocket.interceptor;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.scriptcat.cloudserver.user.model.UserSession;
import org.scriptcat.cloudserver.user.service.UserSessionRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;

@Slf4j
@Component
public class AuthChannelInterceptor implements ChannelInterceptor {
    
    @Autowired
    private UserSessionRegistry userSessionRegistry;
    
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        
        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String username = accessor.getFirstNativeHeader("username");
            
            if (StringUtils.isEmpty(username)) {
                log.error("WebSocket connection rejected: missing username");
                throw new IllegalArgumentException("Username is required");
            }
            
            UserSession session = new UserSession(username);
            userSessionRegistry.register(username, session);
            
            accessor.setUser(new UserPrincipal(username));
            
            log.info("WebSocket connected: {}", username);
        }
        
        return message;
    }
    
    public static class UserPrincipal implements Principal {
        private final String username;
        
        public UserPrincipal(String username) {
            this.username = username;
        }
        
        @Override
        public String getName() {
            return username;
        }
    }
}
