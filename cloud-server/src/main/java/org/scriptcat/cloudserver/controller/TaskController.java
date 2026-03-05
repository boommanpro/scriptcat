package org.scriptcat.cloudserver.controller;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.common.response.ApiResponse;
import org.scriptcat.cloudserver.execution.model.ExecutionTask;
import org.scriptcat.cloudserver.execution.service.ExecutionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    
    @Autowired
    private ExecutionService executionService;
    
    @GetMapping("/{taskId}")
    public ApiResponse<Map<String, Object>> getTask(
            @PathVariable String taskId,
            @RequestParam String username) {
        
        ExecutionTask task = executionService.getTask(taskId);
        
        if (task == null) {
            return ApiResponse.error("Task not found: " + taskId);
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("taskId", task.getTaskId());
        result.put("scriptId", task.getScriptId());
        result.put("status", task.getStatus().name());
        result.put("result", task.getResult());
        result.put("errorMessage", task.getErrorMessage());
        result.put("executionTime", task.getExecutionTime());
        result.put("createdAt", task.getCreatedAt());
        result.put("completedAt", task.getCompletedAt());
        
        return ApiResponse.success(result);
    }
}
