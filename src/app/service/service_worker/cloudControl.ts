import { CloudWebSocketClient, CloudConnectionConfig } from "@App/pkg/cloud/CloudWebSocketClient";
import { AutomationScriptDAO, AutomationScript } from "@App/app/repo/automationScript";

export class CloudControlBackgroundService {
    private client: CloudWebSocketClient | null = null;
    private config: CloudConnectionConfig | null = null;
    private automationScriptDAO: AutomationScriptDAO;

    constructor() {
        this.automationScriptDAO = new AutomationScriptDAO();
        this.config = null;
        this.client = null;
        this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.loadConfig();
        this.setupMessageListener();
    }

    private async loadConfig(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(["cloud_config"]);
            if (result.cloud_config) {
                this.config = result.cloud_config;
                if (this.config && this.config.serverUrl && this.config.username) {
                    await this.connect();
                }
            }
        } catch (error) {
            console.error("[CloudControl] Failed to load config:", error);
        }
    }

    private setupMessageListener(): void {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case "cloud_connect":
                    this.handleConnect(message.config, sendResponse);
                    return true;

                case "cloud_disconnect":
                    this.handleDisconnect(sendResponse);
                    return true;

                case "cloud_get_status":
                    this.handleGetStatus(sendResponse);
                    return true;

                case "cloud_get_scripts":
                    this.handleGetScripts(sendResponse);
                    return true;

                case "cloud_set_script_config":
                    this.handleSetScriptConfig(message.scriptId, message.enabled, sendResponse);
                    return true;

                case "cloud_sync_scripts":
                    this.handleSyncScripts(sendResponse);
                    return true;

                case "cloud_get_logs":
                    this.handleGetLogs(sendResponse);
                    return true;

                case "cloud_clear_logs":
                    this.handleClearLogs(sendResponse);
                    return true;
            }
            return false;
        });
    }

    private async handleConnect(config: CloudConnectionConfig, sendResponse: Function): Promise<void> {
        try {
            this.config = config;
            await chrome.storage.local.set({ cloud_config: config });

            if (!this.client) {
                this.client = new CloudWebSocketClient(config);
                this.setupClientListeners();
            } else {
                this.client.updateConfig(config);
            }

            await this.client.connect();
            sendResponse({ success: true });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    private handleDisconnect(sendResponse: Function): void {
        if (this.client) {
            this.client.disconnect();
        }
        sendResponse({ success: true });
    }

    private handleGetStatus(sendResponse: Function): void {
        const status = this.client?.getStatus() || {
            connected: false,
            connecting: false,
            reconnectAttempts: 0,
        };
        sendResponse({ status });
    }

    private async handleGetScripts(sendResponse: Function): Promise<void> {
        try {
            const scripts = await this.automationScriptDAO.getAllScripts();
            const scriptConfigs = scripts.map((script) => ({
                id: script.id,
                key: script.key,
                name: script.name,
                enabled: true,
                metadata: {
                    version: "1.0.0",
                    namespace: script.key,
                    description: script.description,
                    author: "",
                    match: script.targetUrl ? [script.targetUrl] : [],
                    grant: [],
                    crontab: "",
                    cloudcat: true,
                },
            }));
            sendResponse({ scripts: scriptConfigs });
        } catch (error: any) {
            sendResponse({ scripts: [], error: error.message });
        }
    }

    private async handleSetScriptConfig(scriptId: string, enabled: boolean, sendResponse: Function): Promise<void> {
        if (this.client) {
            await this.client.setScriptReportConfig(scriptId, enabled);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: "Client not initialized" });
        }
    }

    private async handleSyncScripts(sendResponse: Function): Promise<void> {
        if (this.client) {
            await this.client.syncScripts();
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: "Client not connected" });
        }
    }

    private handleGetLogs(sendResponse: Function): void {
        const logs = this.client?.getLogs() || [];
        sendResponse({ logs });
    }

    private handleClearLogs(sendResponse: Function): void {
        if (this.client) {
            this.client.clearLogs();
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false });
        }
    }

    private setupClientListeners(): void {
        if (!this.client) return;

        this.client.on("statusChange", (status) => {
            chrome.runtime.sendMessage({
                action: "cloud_status_change",
                status,
            }).catch(() => { });
        });

        this.client.on("log", (log) => {
            chrome.runtime.sendMessage({
                action: "cloud_log",
                log,
            }).catch(() => { });
        });

        this.client.on("execute", async (data) => {
            const { taskId, scriptId, params } = data;
            try {
                const script = await this.automationScriptDAO.getByKey(scriptId);
                if (script) {
                    await this.executeAutomationScript(script, params);
                    this.client?.send({
                        id: `msg-${Date.now()}`,
                        type: "EXECUTE",
                        action: "script.result",
                        timestamp: Date.now(),
                        data: {
                            taskId,
                            success: true,
                            result: "Script executed successfully",
                            executionTime: 0,
                        },
                    });
                } else {
                    throw new Error(`Script not found: ${scriptId}`);
                }
            } catch (error: any) {
                this.client?.send({
                    id: `msg-${Date.now()}`,
                    type: "EXECUTE",
                    action: "script.result",
                    timestamp: Date.now(),
                    data: {
                        taskId,
                        success: false,
                        error: error.message,
                        executionTime: 0,
                    },
                });
            }
        });
    }

    private async executeAutomationScript(script: AutomationScript, params: any): Promise<void> {
        console.log(`[CloudControl] Executing automation script: ${script.name}`, params);
        // 这里可以调用现有的自动化脚本执行逻辑
        // 由于这是后台服务，可能需要通过消息传递给content script执行
    }

    async connect(): Promise<void> {
        if (this.config && this.config.serverUrl && this.config.username) {
            if (!this.client) {
                this.client = new CloudWebSocketClient(this.config);
                this.setupClientListeners();
            }
            await this.client.connect();
        }
    }

    disconnect(): void {
        if (this.client) {
            this.client.disconnect();
        }
    }
}
