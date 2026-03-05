package org.scriptcat.cloudserver.websocket.message;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Message {
    
    private String id;
    private MessageType type;
    private String action;
    private Long timestamp;
    private String username;
    private String clientId;
    private Map<String, Object> data;
}
