package org.scriptcat.cloudserver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ScriptCatCloudServerApplication {
    
    public static void main(String[] args) {
        SpringApplication.run(ScriptCatCloudServerApplication.class, args);
    }
}
