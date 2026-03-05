package org.scriptcat.cloudserver.execution.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.scriptcat.cloudserver.client.service.ClientRegistry;
import org.scriptcat.cloudserver.common.exception.BusinessException;
import org.scriptcat.cloudserver.execution.model.ExecutionStatus;
import org.scriptcat.cloudserver.execution.model.ExecutionTask;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.scriptcat.cloudserver.script.service.ScriptRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ExecutionServiceTest {
    
    @Autowired
    private ExecutionService executionService;
    
    @Autowired
    private ExecutionRegistry executionRegistry;
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    private static final String TEST_USERNAME = "test@example.com";
    private static final String TEST_CLIENT_ID = "client-test-123";
    private static final String TEST_SCRIPT_ID = "script-test-1";
    
    @BeforeEach
    void setUp() {
        // Clean up test data
        clientRegistry.unregister(TEST_USERNAME, TEST_CLIENT_ID);
        scriptRegistry.removeByClientId(TEST_USERNAME, TEST_CLIENT_ID);
        
        // Setup test client
        ClientInfo clientInfo = ClientInfo.builder()
            .clientId(TEST_CLIENT_ID)
            .username(TEST_USERNAME)
            .status(ClientInfo.ClientStatus.ONLINE)
            .connectedAt(java.time.LocalDateTime.now())
            .lastHeartbeat(java.time.LocalDateTime.now())
            .build();
        clientRegistry.register(TEST_USERNAME, TEST_CLIENT_ID, clientInfo);
        
        // Setup test script
        ScriptInfo scriptInfo = ScriptInfo.builder()
            .scriptId(TEST_SCRIPT_ID)
            .name("Test Script")
            .version("1.0.0")
            .clientId(TEST_CLIENT_ID)
            .username(TEST_USERNAME)
            .build();
        scriptRegistry.register(TEST_USERNAME, TEST_CLIENT_ID, List.of(scriptInfo));
    }
    
    @Test
    void shouldCreateExecutionTask() {
        ExecutionTask task = executionService.executeScript(TEST_USERNAME, TEST_SCRIPT_ID, Map.of("param1", "value1"));
        
        assertNotNull(task);
        assertNotNull(task.getTaskId());
        assertEquals(TEST_SCRIPT_ID, task.getScriptId());
        assertEquals(TEST_USERNAME, task.getUsername());
        assertEquals(TEST_CLIENT_ID, task.getClientId());
        assertEquals(ExecutionStatus.PENDING, task.getStatus());
        assertNotNull(task.getCreatedAt());
    }
    
    @Test
    void shouldThrowExceptionWhenScriptNotFound() {
        assertThrows(BusinessException.class, () -> {
            executionService.executeScript(TEST_USERNAME, "non-existent-script", Map.of());
        });
    }
    
    @Test
    void shouldUpdateExecutionResult() {
        ExecutionTask task = executionService.executeScript(TEST_USERNAME, TEST_SCRIPT_ID, Map.of());
        
        Map<String, Object> resultData = Map.of(
            "taskId", task.getTaskId(),
            "success", true,
            "result", "Test result",
            "executionTime", 1234L
        );
        
        executionService.updateResult(TEST_USERNAME, resultData);
        
        ExecutionTask updatedTask = executionRegistry.get(task.getTaskId());
        assertEquals(ExecutionStatus.SUCCESS, updatedTask.getStatus());
        assertEquals("Test result", updatedTask.getResult());
        assertNotNull(updatedTask.getCompletedAt());
        assertEquals(1234L, updatedTask.getExecutionTime());
    }
    
    @Test
    void shouldGetTaskById() {
        ExecutionTask task = executionService.executeScript(TEST_USERNAME, TEST_SCRIPT_ID, Map.of());
        
        ExecutionTask retrievedTask = executionService.getTask(task.getTaskId());
        
        assertNotNull(retrievedTask);
        assertEquals(task.getTaskId(), retrievedTask.getTaskId());
    }
}
