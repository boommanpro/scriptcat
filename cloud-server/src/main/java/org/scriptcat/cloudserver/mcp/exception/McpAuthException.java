package org.scriptcat.cloudserver.mcp.exception;

public class McpAuthException extends RuntimeException {
    public McpAuthException(String message) {
        super(message);
    }
    
    public McpAuthException(String message, Throwable cause) {
        super(message, cause);
    }
}
