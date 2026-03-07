package org.scriptcat.cloudserver.mcp.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice(basePackages = "org.scriptcat.cloudserver.mcp")
public class McpExceptionHandler {
    
    @ExceptionHandler(McpAuthException.class)
    public ResponseEntity<Map<String, Object>> handleMcpAuthException(McpAuthException e) {
        log.warn("MCP authentication error: {}", e.getMessage());
        
        Map<String, Object> error = new HashMap<>();
        error.put("error", "authentication_error");
        error.put("message", e.getMessage());
        
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
    
    @ExceptionHandler(McpToolNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleMcpToolNotFoundException(McpToolNotFoundException e) {
        log.warn("MCP tool not found: {}", e.getMessage());
        
        Map<String, Object> error = new HashMap<>();
        error.put("error", "tool_not_found");
        error.put("message", e.getMessage());
        
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }
    
    @ExceptionHandler(McpExecutionException.class)
    public ResponseEntity<Map<String, Object>> handleMcpExecutionException(McpExecutionException e) {
        log.error("MCP execution error: {}", e.getMessage(), e);
        
        Map<String, Object> error = new HashMap<>();
        error.put("error", "execution_error");
        error.put("message", e.getMessage());
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception e) {
        log.error("Unexpected MCP error: {}", e.getMessage(), e);
        
        Map<String, Object> error = new HashMap<>();
        error.put("error", "internal_error");
        error.put("message", "An unexpected error occurred");
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
