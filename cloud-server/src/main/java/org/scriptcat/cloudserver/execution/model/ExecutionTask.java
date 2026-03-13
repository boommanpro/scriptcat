package org.scriptcat.cloudserver.execution.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionTask {
    
    private String taskId;
    private String scriptId;
    private String username;
    private String clientId;
    private ExecutionStatus status;
    private Map<String, Object> params;
    private Object result;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Long executionTime;
}
