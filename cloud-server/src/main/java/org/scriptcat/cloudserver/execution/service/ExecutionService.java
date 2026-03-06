package org.scriptcat.cloudserver.execution.service;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.scriptcat.cloudserver.client.service.ClientRegistry;
import org.scriptcat.cloudserver.common.exception.BusinessException;
import org.scriptcat.cloudserver.common.util.IdGenerator;
import org.scriptcat.cloudserver.controller.ManagementWebSocketController;
import org.scriptcat.cloudserver.execution.model.ExecutionStatus;
import org.scriptcat.cloudserver.execution.model.ExecutionTask;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.scriptcat.cloudserver.script.service.ScriptRegistry;
import org.scriptcat.cloudserver.websocket.handler.RawWebSocketHandler;
import org.scriptcat.cloudserver.websocket.message.Message;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Service
public class ExecutionService {
    
    @Autowired
    private ExecutionRegistry executionRegistry;
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @Autowired
    @Lazy
    private RawWebSocketHandler webSocketHandler;
    
    @Autowired
    private ManagementWebSocketController managementController;
    
    public ExecutionTask executeScript(String username, String scriptId, Map<String, Object> params) {
        ScriptInfo script = scriptRegistry.getScript(username, scriptId);
        if (script == null) {
            throw new BusinessException("Script not found: " + scriptId);
        }
        
        ClientInfo client = clientRegistry.get(username, script.getClientId());
        if (client == null || client.getStatus() != ClientInfo.ClientStatus.ONLINE) {
            throw new BusinessException("Client offline: " + script.getClientId());
        }
        
        ExecutionTask task = ExecutionTask.builder()
            .taskId(IdGenerator.generateTaskId())
            .scriptId(scriptId)
            .username(username)
            .clientId(script.getClientId())
            .status(ExecutionStatus.PENDING)
            .params(params)
            .createdAt(LocalDateTime.now())
            .build();
        
        executionRegistry.register(task);
        managementController.notifyTaskCreated(task);
        
        Message message = Message.builder()
            .id(IdGenerator.generateMessageId())
            .type("EXECUTE")
            .action("script.execute")
            .timestamp(System.currentTimeMillis())
            .username(username)
            .clientId(script.getClientId())
            .data(Map.of(
                "taskId", task.getTaskId(),
                "scriptId", scriptId,
                "params", params != null ? params : Map.of()
            ))
            .build();
        
        try {
            webSocketHandler.sendMessageToClient(username, script.getClientId(), message);
            log.info("Execution task created: {}, script: {}", task.getTaskId(), scriptId);
        } catch (Exception e) {
            log.error("Failed to send execution message: {}", e.getMessage(), e);
            throw new BusinessException("Failed to send execution message: " + e.getMessage());
        }
        
        return task;
    }
    
    public void updateResult(String username, Map<String, Object> data) {
        String taskId = (String) data.get("taskId");
        Boolean success = (Boolean) data.get("success");
        Object result = data.get("result");
        String error = (String) data.get("error");
        
        ExecutionStatus status = success ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED;
        executionRegistry.update(taskId, status, result, error);
        
        ExecutionTask task = executionRegistry.get(taskId);
        if (task != null) {
            managementController.notifyTaskUpdated(task);
        }
    }
    
    public ExecutionTask getTask(String taskId) {
        return executionRegistry.get(taskId);
    }
}
