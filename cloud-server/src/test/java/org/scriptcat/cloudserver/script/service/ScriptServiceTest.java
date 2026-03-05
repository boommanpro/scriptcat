package org.scriptcat.cloudserver.script.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ScriptServiceTest {
    
    @Autowired
    private ScriptService scriptService;
    
    @Autowired
    private ScriptRegistry scriptRegistry;
    
    private static final String TEST_USERNAME = "test@example.com";
    private static final String TEST_CLIENT_ID = "client-test-123";
    
    @BeforeEach
    void setUp() {
        // Clean up test data
        scriptRegistry.removeByClientId(TEST_USERNAME, TEST_CLIENT_ID);
    }
    
    @Test
    void shouldSyncScriptsSuccessfully() {
        Map<String, Object> scriptData1 = new HashMap<>();
        scriptData1.put("id", "script-1");
        scriptData1.put("name", "Test Script 1");
        scriptData1.put("version", "1.0.0");
        scriptData1.put("metadata", Map.of("description", "Test script"));
        
        Map<String, Object> scriptData2 = new HashMap<>();
        scriptData2.put("id", "script-2");
        scriptData2.put("name", "Test Script 2");
        scriptData2.put("version", "2.0.0");
        
        Map<String, Object> data = Map.of("scripts", List.of(scriptData1, scriptData2));
        
        scriptService.syncScripts(TEST_USERNAME, TEST_CLIENT_ID, data);
        
        List<ScriptInfo> scripts = scriptService.getScripts(TEST_USERNAME);
        assertEquals(2, scripts.size());
        
        ScriptInfo script1 = scriptService.getScript(TEST_USERNAME, "script-1");
        assertNotNull(script1);
        assertEquals("Test Script 1", script1.getName());
        assertEquals("1.0.0", script1.getVersion());
        assertEquals(TEST_CLIENT_ID, script1.getClientId());
        assertEquals(TEST_USERNAME, script1.getUsername());
    }
    
    @Test
    void shouldGetScriptsByUsername() {
        Map<String, Object> scriptData = new HashMap<>();
        scriptData.put("id", "script-3");
        scriptData.put("name", "Test Script 3");
        scriptData.put("version", "1.0.0");
        
        Map<String, Object> data = Map.of("scripts", List.of(scriptData));
        
        scriptService.syncScripts(TEST_USERNAME, TEST_CLIENT_ID, data);
        
        List<ScriptInfo> scripts = scriptService.getScripts(TEST_USERNAME);
        
        assertFalse(scripts.isEmpty());
        assertTrue(scripts.stream().anyMatch(s -> "script-3".equals(s.getScriptId())));
    }
}
