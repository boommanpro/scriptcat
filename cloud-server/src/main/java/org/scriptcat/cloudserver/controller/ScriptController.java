package org.scriptcat.cloudserver.controller;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.common.response.ApiResponse;
import org.scriptcat.cloudserver.execution.model.ExecutionTask;
import org.scriptcat.cloudserver.execution.service.ExecutionService;
import org.scriptcat.cloudserver.script.model.ScriptInfo;
import org.scriptcat.cloudserver.script.service.ScriptService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/scripts")
public class ScriptController {
    
    @Autowired
    private ScriptService scriptService;
    
    @Autowired
    private ExecutionService executionService;
    
    @GetMapping
    public ApiResponse<Map<String, Object>> getScripts(@RequestParam String username) {
        List<ScriptInfo> scripts = scriptService.getScripts(username);
        
        Map<String, Object> result = new HashMap<>();
        result.put("scripts", scripts);
        result.put("total", scripts.size());
        
        return ApiResponse.success(result);
    }
    
    @PostMapping("/{scriptId}/execute")
    public ApiResponse<Map<String, Object>> executeScript(
            @PathVariable String scriptId,
            @RequestBody Map<String, Object> request) {
        
        String username = (String) request.get("username");
        @SuppressWarnings("unchecked")
        Map<String, Object> params = (Map<String, Object>) request.get("params");
        
        ExecutionTask task = executionService.executeScript(username, scriptId, params);
        
        Map<String, Object> result = new HashMap<>();
        result.put("taskId", task.getTaskId());
        result.put("scriptId", task.getScriptId());
        result.put("status", task.getStatus().name());
        
        return ApiResponse.success(result);
    }
}
