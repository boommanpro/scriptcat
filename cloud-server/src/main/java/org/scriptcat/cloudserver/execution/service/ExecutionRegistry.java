package org.scriptcat.cloudserver.execution.service;

import lombok.extern.slf4j.Slf4j;
import org.scriptcat.cloudserver.execution.model.ExecutionStatus;
import org.scriptcat.cloudserver.execution.model.ExecutionTask;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Component
public class ExecutionRegistry {
    
    private final ConcurrentHashMap<String, ExecutionTask> tasks = new ConcurrentHashMap<>();
    
    public void register(ExecutionTask task) {
        tasks.put(task.getTaskId(), task);
        log.info("Task registered: {}", task.getTaskId());
    }
    
    public ExecutionTask get(String taskId) {
        return tasks.get(taskId);
    }
    
    public void update(String taskId, ExecutionStatus status, Object result, String error) {
        ExecutionTask task = tasks.get(taskId);
        if (task != null) {
            task.setStatus(status);
            task.setResult(result);
            task.setErrorMessage(error);
            task.setCompletedAt(LocalDateTime.now());
            if (task.getStartedAt() != null) {
                task.setExecutionTime(
                    Duration.between(task.getStartedAt(), task.getCompletedAt()).toMillis()
                );
            }
            log.info("Task updated: {}, status: {}", taskId, status);
        }
    }
    
    public void updateStatus(String taskId, ExecutionStatus status) {
        ExecutionTask task = tasks.get(taskId);
        if (task != null) {
            task.setStatus(status);
            if (status == ExecutionStatus.RUNNING) {
                task.setStartedAt(LocalDateTime.now());
            }
            log.info("Task status updated: {}, status: {}", taskId, status);
        }
    }
    
    public List<ExecutionTask> getByUsername(String username) {
        return tasks.values().stream()
            .filter(task -> username.equals(task.getUsername()))
            .collect(Collectors.toList());
    }
    
    public List<ExecutionTask> getRecentTasks(int limit) {
        return tasks.values().stream()
            .sorted((t1, t2) -> t2.getCreatedAt().compareTo(t1.getCreatedAt()))
            .limit(limit)
            .collect(Collectors.toList());
    }
}
