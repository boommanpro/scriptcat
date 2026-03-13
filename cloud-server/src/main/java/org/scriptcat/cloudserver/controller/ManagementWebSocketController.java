package org.scriptcat.cloudserver.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.scriptcat.cloudserver.execution.model.ExecutionTask;
import org.scriptcat.cloudserver.websocket.message.Message;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Controller
public class ManagementWebSocketController {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, WebSocketSession> managementSessions = new ConcurrentHashMap<>();
    
    public void registerManagementSession(WebSocketSession session) {
        managementSessions.put(session.getId(), session);
        log.info("Management session registered: {}", session.getId());
    }
    
    public void unregisterManagementSession(WebSocketSession session) {
        managementSessions.remove(session.getId());
        log.info("Management session unregistered: {}", session.getId());
    }
    
    public void notifyClientConnected(ClientInfo client) {
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "CLIENT_CONNECTED");
        notification.put("client", client);
        notification.put("timestamp", System.currentTimeMillis());
        
        sendToManagement(notification);
        log.info("Notified client connected: {}", client.getClientId());
    }
    
    public void notifyClientDisconnected(String username, String clientId) {
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "CLIENT_DISCONNECTED");
        notification.put("username", username);
        notification.put("clientId", clientId);
        notification.put("timestamp", System.currentTimeMillis());
        
        sendToManagement(notification);
        log.info("Notified client disconnected: {}", clientId);
    }
    
    public void notifyScriptSynced(String username, String clientId, int scriptCount) {
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "SCRIPT_SYNCED");
        notification.put("username", username);
        notification.put("clientId", clientId);
        notification.put("scriptCount", scriptCount);
        notification.put("timestamp", System.currentTimeMillis());
        
        sendToManagement(notification);
        log.info("Notified script synced: {} scripts from {}", scriptCount, clientId);
    }
    
    public void notifyTaskCreated(ExecutionTask task) {
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "TASK_CREATED");
        notification.put("task", task);
        notification.put("timestamp", System.currentTimeMillis());
        
        sendToManagement(notification);
        log.info("Notified task created: {}", task.getTaskId());
    }
    
    public void notifyTaskUpdated(ExecutionTask task) {
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "TASK_UPDATED");
        notification.put("task", task);
        notification.put("timestamp", System.currentTimeMillis());
        
        sendToManagement(notification);
        log.info("Notified task updated: {} - {}", task.getTaskId(), task.getStatus());
    }
    
    private void sendToManagement(Map<String, Object> notification) {
        Message message = Message.builder()
            .type("MANAGEMENT_NOTIFICATION")
            .action("management.notify")
            .timestamp(System.currentTimeMillis())
            .data(notification)
            .build();
        
        try {
            String json = objectMapper.writeValueAsString(message);
            TextMessage textMessage = new TextMessage(json);
            
            for (WebSocketSession session : managementSessions.values()) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(textMessage);
                    } catch (Exception e) {
                        log.error("Failed to send notification to management session {}: {}", 
                            session.getId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to serialize management notification: {}", e.getMessage(), e);
        }
    }
}
