package org.scriptcat.cloudserver.mcp.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.mcp.auth")
public class McpAuthProperties {
    
    private boolean enabled = true;
    private String headerName = "Authorization";
    private String tokenPrefix = "Bearer ";
}
