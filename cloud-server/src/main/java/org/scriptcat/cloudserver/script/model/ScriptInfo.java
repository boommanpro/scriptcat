package org.scriptcat.cloudserver.script.model;

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
public class ScriptInfo {
    
    private String scriptId;
    private String name;
    private String version;
    private String clientId;
    private String username;
    private LocalDateTime syncedAt;
    private Map<String, Object> metadata;
}
