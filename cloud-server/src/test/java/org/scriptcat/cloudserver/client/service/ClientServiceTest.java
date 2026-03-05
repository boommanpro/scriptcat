package org.scriptcat.cloudserver.client.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.scriptcat.cloudserver.client.model.ClientInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ClientServiceTest {
    
    @Autowired
    private ClientService clientService;
    
    @Autowired
    private ClientRegistry clientRegistry;
    
    private static final String TEST_USERNAME = "test@example.com";
    private static final String TEST_CLIENT_ID = "client-test-123";
    
    @BeforeEach
    void setUp() {
        // Clean up test data
        clientRegistry.unregister(TEST_USERNAME, TEST_CLIENT_ID);
    }
    
    @Test
    void shouldRegisterClientSuccessfully() {
        Map<String, Object> data = Map.of("version", "1.0.0", "platform", "chrome");
        
        clientService.registerClient(TEST_USERNAME, TEST_CLIENT_ID, data);
        
        ClientInfo client = clientRegistry.get(TEST_USERNAME, TEST_CLIENT_ID);
        assertNotNull(client);
        assertEquals(TEST_CLIENT_ID, client.getClientId());
        assertEquals(TEST_USERNAME, client.getUsername());
        assertEquals(ClientInfo.ClientStatus.ONLINE, client.getStatus());
        assertNotNull(client.getConnectedAt());
        assertNotNull(client.getLastHeartbeat());
    }
    
    @Test
    void shouldGetClientsByUsername() {
        Map<String, Object> data = Map.of("version", "1.0.0");
        
        clientService.registerClient(TEST_USERNAME, TEST_CLIENT_ID, data);
        clientService.registerClient(TEST_USERNAME, "client-test-456", data);
        
        List<ClientInfo> clients = clientService.getClients(TEST_USERNAME);
        
        assertEquals(2, clients.size());
    }
    
    @Test
    void shouldDisconnectClient() {
        Map<String, Object> data = Map.of("version", "1.0.0");
        clientService.registerClient(TEST_USERNAME, TEST_CLIENT_ID, data);
        
        clientService.disconnectClient(TEST_USERNAME, TEST_CLIENT_ID);
        
        ClientInfo client = clientRegistry.get(TEST_USERNAME, TEST_CLIENT_ID);
        assertNull(client);
    }
}
