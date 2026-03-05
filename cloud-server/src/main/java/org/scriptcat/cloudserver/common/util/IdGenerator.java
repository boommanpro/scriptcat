package org.scriptcat.cloudserver.common.util;

import java.util.UUID;

public class IdGenerator {
    
    public static String generateTaskId() {
        return "task-" + System.currentTimeMillis() + "-" + 
            UUID.randomUUID().toString().substring(0, 8);
    }
    
    public static String generateMessageId() {
        return "msg-" + System.currentTimeMillis() + "-" + 
            UUID.randomUUID().toString().substring(0, 8);
    }
    
    public static String generateClientId() {
        return "client-" + System.currentTimeMillis() + "-" + 
            UUID.randomUUID().toString().substring(0, 8);
    }
}
