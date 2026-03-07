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
    private static final String AUTH_HEADER_NAME = "Authorization";
    private static final String TOKEN_PREFIX = "Bearer ";
    
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String authHeader = request.getHeader(AUTH_HEADER_NAME);
        if (authHeader == null || authHeader.isEmpty()) {
            log.warn("MCP request missing Authorization header from {}", request.getRemoteAddr());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Missing Authorization header\"}");
            return false;
        }
        
        if (!authHeader.startsWith(TOKEN_PREFIX)) {
            log.warn("MCP request invalid Authorization header format from {}", request.getRemoteAddr());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Invalid Authorization header format\"}");
            return false;
        }
        
        String username = authHeader.substring(TOKEN_PREFIX.length()).trim();
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
