package org.scriptcat.cloudserver.mcp.exception;

public class McpExecutionException extends RuntimeException {
    public McpExecutionException(String message) {
        super(message);
    }
    
    public McpExecutionException(String message, Throwable cause) {
        super(message, cause);
    }
}
