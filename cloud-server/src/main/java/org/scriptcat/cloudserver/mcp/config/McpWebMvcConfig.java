package org.scriptcat.cloudserver.mcp.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.autoconfigure.mcp.server.MpcServerAutoConfiguration;
import org.springframework.ai.autoconfigure.mcp.server.MpcWebMvcServerAutoConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Slf4j
@Configuration
@EnableAutoConfiguration(exclude = {
    MpcServerAutoConfiguration.class,
    MpcWebMvcServerAutoConfiguration.class
})
public class McpWebMvcConfig implements WebMvcConfigurer {
    
    private final McpAuthInterceptor mcpAuthInterceptor;
    
    public McpWebMvcConfig(McpAuthInterceptor mcpAuthInterceptor) {
        this.mcpAuthInterceptor = mcpAuthInterceptor;
    }
    
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(mcpAuthInterceptor)
            .addPathPatterns("/sse")
            .addPathPatterns("/mcp/**")
            .excludePathPatterns("/mcp/health", "/mcp/info");
        
        log.info("MCP authentication interceptor registered for /sse and /mcp/**");
    }
}
