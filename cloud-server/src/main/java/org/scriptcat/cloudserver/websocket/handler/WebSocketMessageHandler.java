package org.scriptcat.cloudserver.websocket.handler;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.service.ClientService;
import org.scriptcat.cloudserver.common.response.ApiResponse;
import org.scriptcat.cloudserver.execution.service.ExecutionService;
import org.scriptcat.cloudserver.script.service.ScriptService;
import org.scriptcat.cloudserver.websocket.interceptor.AuthChannelInterceptor;
import org.scriptcat.cloudserver.websocket.message.Message;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Map;

@Slf4j
@Controller
public class WebSocketMessageHandler {
    
    @Autowired
    private ClientService clientService;
    
    @Autowired
    private ScriptService scriptService;
    
    @Autowired
    private ExecutionService executionService;
    
    @MessageMapping("/auth")
    @SendToUser("/queue/auth")
    public ApiResponse handleAuth(@Payload Message message, Principal principal) {
        String username = principal.getName();
        log.info("Auth request from: {}, client: {}", username, message.getClientId());
        
        clientService.registerClient(username, message.getClientId(), message.getData());
        
        return ApiResponse.success("Authentication successful");
    }
    
    @MessageMapping("/script/sync")
    @SendToUser("/queue/script/sync")
    public ApiResponse handleScriptSync(@Payload Message message, Principal principal) {
        String username = principal.getName();
        log.info("Script sync from: {}, client: {}", username, message.getClientId());
        
        scriptService.syncScripts(username, message.getClientId(), message.getData());
        
        return ApiResponse.success("Scripts synced successfully");
    }
    
    @MessageMapping("/execution/result")
    public void handleExecutionResult(@Payload Message message, Principal principal) {
        String username = principal.getName();
        log.info("Execution result from: {}, task: {}", username, message.getData().get("taskId"));
        
        executionService.updateResult(username, message.getData());
    }
    
    @MessageMapping("/heartbeat")
    public void handleHeartbeat(@Payload Message message, Principal principal) {
        String username = principal.getName();
        String clientId = message.getClientId();
        
        clientService.updateHeartbeat(username, clientId);
    }
    
    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();
        
        if (principal != null) {
            String username = principal.getName();
            log.info("Session disconnected: {}", username);
            
            // Clean up clients and scripts
            clientService.getClients(username).forEach(client -> {
                clientService.disconnectClient(username, client.getClientId());
            });
        }
    }
}
