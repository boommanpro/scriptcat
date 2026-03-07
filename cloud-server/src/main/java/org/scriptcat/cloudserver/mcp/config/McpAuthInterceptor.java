package org.scriptcat.cloudserver.mcp.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Slf4j
@Component
public class McpAuthInterceptor implements HandlerInterceptor {
    
    private static final String USERNAME_ATTRIBUTE = "mcp_username";
    
    @Autowired
    private McpAuthProperties authProperties;
    
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!authProperties.isEnabled()) {
            return true;
        }
        
        String authHeader = request.getHeader(authProperties.getHeaderName());
        if (authHeader == null || authHeader.isEmpty()) {
            log.warn("MCP request missing Authorization header from {}", request.getRemoteAddr());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Missing Authorization header\"}");
            return false;
        }
        
        String tokenPrefix = authProperties.getTokenPrefix();
        if (!authHeader.startsWith(tokenPrefix)) {
            log.warn("MCP request invalid Authorization header format from {}", request.getRemoteAddr());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Invalid Authorization header format\"}");
            return false;
        }
        
        String username = authHeader.substring(tokenPrefix.length()).trim();
        if (username.isEmpty()) {
            log.warn("MCP request empty username in token from {}", request.getRemoteAddr());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Empty username in token\"}");
            return false;
        }
        
        request.setAttribute(USERNAME_ATTRIBUTE, username);
        log.debug("MCP request authenticated for user: {}", username);
        return true;
    }
    
    public static String getUsername(HttpServletRequest request) {
        return (String) request.getAttribute(USERNAME_ATTRIBUTE);
    }
}
