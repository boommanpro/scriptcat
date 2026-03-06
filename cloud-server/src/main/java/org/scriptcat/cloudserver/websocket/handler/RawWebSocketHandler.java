package org.scriptcat.cloudserver.websocket.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.scriptcat.cloudserver.client.service.ClientService;
import org.scriptcat.cloudserver.controller.ManagementWebSocketController;
import org.scriptcat.cloudserver.execution.service.ExecutionService;
import org.scriptcat.cloudserver.script.service.ScriptService;
import org.scriptcat.cloudserver.websocket.message.Message;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class RawWebSocketHandler extends TextWebSocketHandler {
    
    @Autowired
    private ClientService clientService;
    
    @Autowired
    private ScriptService scriptService;
    
    @Autowired
    private ExecutionService executionService;
    
    @Autowired
    private ManagementWebSocketController managementController;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToUser = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToClient = new ConcurrentHashMap<>();
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket connection established: {}", session.getId());
        sessions.put(session.getId(), session);
    }
    
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.debug("Received message from session {}: {}", session.getId(), payload);
        
        try {
            Message msg = objectMapper.readValue(payload, Message.class);
            handleMessage(session, msg);
        } catch (Exception e) {
            log.error("Error handling message: {}", e.getMessage(), e);
            sendError(session, "Invalid message format");
        }
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("WebSocket connection closed: {}, status: {}", session.getId(), status);
        
        String sessionId = session.getId();
        sessions.remove(sessionId);
        
        String username = sessionToUser.remove(sessionId);
        String clientId = sessionToClient.remove(sessionId);
        
        // 检查是否是管理页面连接
        if ("management".equals(username) && clientId != null && clientId.startsWith("management-")) {
            managementController.unregisterManagementSession(session);
        } else if (username != null && clientId != null) {
            clientService.disconnectClient(username, clientId);
        }
    }
    
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("WebSocket transport error for session {}: {}", session.getId(), exception.getMessage());
    }
    
    private void handleMessage(WebSocketSession session, Message message) throws Exception {
        String type = message.getType();
        String action = message.getAction();
        
        log.info("Handling message - type: {}, action: {}, username: {}, clientId: {}", 
            type, action, message.getUsername(), message.getClientId());
        
        switch (type) {
            case "AUTH":
                handleAuth(session, message);
                break;
            case "SCRIPT_LIST":
                handleScriptSync(session, message);
                break;
            case "EXECUTE":
                handleExecuteResult(session, message);
                break;
            case "HEARTBEAT":
                handleHeartbeat(session, message);
                break;
            default:
                log.warn("Unknown message type: {}", type);
                sendError(session, "Unknown message type: " + type);
        }
    }
    
    private void handleAuth(WebSocketSession session, Message message) throws Exception {
        String username = message.getUsername();
        String clientId = message.getClientId();
        
        if (username == null || username.isEmpty()) {
            sendError(session, "Username is required");
            return;
        }
        
        if (clientId == null || clientId.isEmpty()) {
            sendError(session, "ClientId is required");
            return;
        }
        
        sessionToUser.put(session.getId(), username);
        sessionToClient.put(session.getId(), clientId);
        
        // 检查是否是管理页面连接
        if ("management".equals(username) && clientId.startsWith("management-")) {
            managementController.registerManagementSession(session);
            sendSuccess(session, "AUTH", "auth.response", "Management connection successful");
            log.info("Management session authenticated: {}", session.getId());
        } else {
            clientService.registerClient(username, clientId, message.getData());
            sendSuccess(session, "AUTH", "auth.response", "Authentication successful");
            log.info("Client authenticated: {} - {}", username, clientId);
        }
    }
    
    private void handleScriptSync(WebSocketSession session, Message message) throws Exception {
        String username = sessionToUser.get(session.getId());
        String clientId = sessionToClient.get(session.getId());
        
        if (username == null || clientId == null) {
            sendError(session, "Not authenticated");
            return;
        }
        
        scriptService.syncScripts(username, clientId, message.getData());
        
        sendSuccess(session, "SCRIPT_LIST", "script.sync.response", "Scripts synced successfully");
        log.info("Scripts synced: {} - {}, count: {}", username, clientId, 
            message.getData() != null && message.getData().containsKey("scripts") ? 
            ((java.util.List<?>) message.getData().get("scripts")).size() : 0);
    }
    
    private void handleExecuteResult(WebSocketSession session, Message message) throws Exception {
        String username = sessionToUser.get(session.getId());
        
        if (username == null) {
            sendError(session, "Not authenticated");
            return;
        }
        
        executionService.updateResult(username, message.getData());
        log.info("Execution result received: {}", message.getData().get("taskId"));
    }
    
    private void handleHeartbeat(WebSocketSession session, Message message) throws Exception {
        String username = sessionToUser.get(session.getId());
        String clientId = sessionToClient.get(session.getId());
        
        if (username != null && clientId != null) {
            clientService.updateHeartbeat(username, clientId);
        }
    }
    
    private void sendSuccess(WebSocketSession session, String type, String action, String message) throws Exception {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", message);
        
        Message responseMsg = new Message();
        responseMsg.setType(type);
        responseMsg.setAction(action);
        responseMsg.setData(response);
        responseMsg.setTimestamp(System.currentTimeMillis());
        
        String json = objectMapper.writeValueAsString(responseMsg);
        session.sendMessage(new TextMessage(json));
    }
    
    private void sendError(WebSocketSession session, String errorMessage) throws Exception {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", errorMessage);
        
        Message responseMsg = new Message();
        responseMsg.setType("ERROR");
        responseMsg.setAction("error");
        responseMsg.setData(response);
        responseMsg.setTimestamp(System.currentTimeMillis());
        
        String json = objectMapper.writeValueAsString(responseMsg);
        session.sendMessage(new TextMessage(json));
    }
    
    public void sendMessageToClient(String username, String clientId, Message message) throws Exception {
        for (Map.Entry<String, WebSocketSession> entry : sessions.entrySet()) {
            String sessionId = entry.getKey();
            WebSocketSession session = entry.getValue();
            
            if (sessionToUser.get(sessionId).equals(username) && 
                sessionToClient.get(sessionId).equals(clientId)) {
                
                String json = objectMapper.writeValueAsString(message);
                session.sendMessage(new TextMessage(json));
                log.debug("Message sent to client: {} - {}", username, clientId);
                return;
            }
        }
        log.warn("Client not found: {} - {}", username, clientId);
    }
}
