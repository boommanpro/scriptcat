import { v4 as uuidv4 } from "uuid";

export interface CloudConnectionConfig {
    serverUrl: string;
    username: string;
    autoReconnect: boolean;
    reconnectInterval: number;
    heartbeatInterval: number;
}

export interface CloudMessage {
    id: string;
    type: "AUTH" | "SCRIPT_LIST" | "EXECUTE" | "STATUS" | "HEARTBEAT" | "ERROR";
    action: string;
    timestamp: number;
    username?: string;
    clientId?: string;
    data: any;
}

export interface CloudConnectionStatus {
    connected: boolean;
    connecting: boolean;
    lastHeartbeat?: number;
    reconnectAttempts: number;
    error?: string;
}

export interface ScriptReportConfig {
    scriptId: string;
    scriptName: string;
    enabled: boolean;
    lastReport?: number;
}

export interface CommunicationLog {
    id: string;
    timestamp: number;
    direction: "send" | "receive";
    type: string;
    action: string;
    data: any;
    success?: boolean;
    error?: string;
}

export type ScriptFetcher = () => Promise<any[]>;

export class CloudWebSocketClient {
    private socket: WebSocket | null = null;
    private config: CloudConnectionConfig;
    private status: CloudConnectionStatus;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private reportTimer: NodeJS.Timeout | null = null;
    private clientId: string;
    private logs: CommunicationLog[] = [];
    private scriptConfigs: Map<string, ScriptReportConfig> = new Map();
    private listeners: Map<string, Set<(data: any) => void>> = new Map();
    private scriptFetcher: ScriptFetcher;

    private maxLogs = 1000;
    private maxReconnectAttempts = 5;

    constructor(config: CloudConnectionConfig, scriptFetcher?: ScriptFetcher) {
        this.config = config;
        this.clientId = "";
        this.status = {
            connected: false,
            connecting: false,
            reconnectAttempts: 0,
        };
        this.scriptFetcher = scriptFetcher || this.defaultScriptFetcher.bind(this);
        this.initializeClientId();
        this.loadScriptConfigs();
    }

    private async defaultScriptFetcher(): Promise<any[]> {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "cloud_get_scripts" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[CloudWS] defaultScriptFetcher error:", chrome.runtime.lastError);
                    resolve([]);
                    return;
                }
                if (response?.scripts) {
                    console.log("[CloudWS] defaultScriptFetcher received:", response.scripts.length, "scripts");
                    resolve(response.scripts);
                } else {
                    console.log("[CloudWS] defaultScriptFetcher: no scripts in response", response);
                    resolve([]);
                }
            });
        });
    }

    private async initializeClientId(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(["cloud_client_id"]);
            let clientId = result.cloud_client_id;
            if (!clientId) {
                clientId = `client-${Date.now()}-${uuidv4().substring(0, 8)}`;
                await chrome.storage.local.set({ cloud_client_id: clientId });
            }
            this.clientId = clientId;
        } catch (error) {
            console.error("[CloudWS] Failed to initialize client ID:", error);
            this.clientId = `client-${Date.now()}-${uuidv4().substring(0, 8)}`;
        }
    }

    private async loadScriptConfigs(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(["cloud_script_configs"]);
            if (result.cloud_script_configs) {
                const configs = result.cloud_script_configs;
                this.scriptConfigs = new Map(Object.entries(configs));
            }
        } catch (error) {
            console.error("[CloudWS] Failed to load script configs:", error);
        }
    }

    private async saveScriptConfigs(): Promise<void> {
        try {
            const configs = Object.fromEntries(this.scriptConfigs);
            await chrome.storage.local.set({ cloud_script_configs: configs });
        } catch (error) {
            console.error("[CloudWS] Failed to save script configs:", error);
        }
    }

    async connect(): Promise<void> {
        if (this.status.connected || this.status.connecting) {
            return;
        }

        // 确保clientId已初始化
        if (!this.clientId) {
            await this.initializeClientId();
        }

        this.status.connecting = true;
        this.status.error = undefined;
        this.notifyStatusChange();

        try {
            await this.createConnection();
            await this.authenticate();
            this.startHeartbeat();
            this.startScriptReport();
            this.status.connected = true;
            this.status.connecting = false;
            this.status.reconnectAttempts = 0;
            this.notifyStatusChange();
            this.addLog("receive", "AUTH", "auth.response", { success: true, message: "Connected successfully" });

            // 连接成功后自动保存配置
            await this.saveConfig();
        } catch (error: any) {
            this.status.connecting = false;
            this.status.error = error.message;
            this.notifyStatusChange();
            this.addLog("receive", "ERROR", "connection.failed", { error: error.message }, false, error.message);

            if (this.config.autoReconnect && this.status.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }

            throw error;
        }
    }

    private async saveConfig(): Promise<void> {
        try {
            await chrome.storage.local.set({ cloud_config: this.config });
            console.log("[CloudWS] Config saved successfully");
        } catch (error) {
            console.error("[CloudWS] Failed to save config:", error);
        }
    }

    private createConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.config.serverUrl);

                this.socket.onopen = () => {
                    console.log("[CloudWS] WebSocket connected");
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    this.handleMessage(JSON.parse(event.data));
                };

                this.socket.onerror = (error) => {
                    console.error("[CloudWS] WebSocket error:", error);
                    reject(new Error("WebSocket connection error"));
                };

                this.socket.onclose = () => {
                    console.log("[CloudWS] WebSocket closed");
                    this.handleDisconnect();
                };
            } catch (error: any) {
                reject(error);
            }
        });
    }

    private async authenticate(): Promise<void> {
        const message: CloudMessage = {
            id: this.generateMessageId(),
            type: "AUTH",
            action: "auth.login",
            timestamp: Date.now(),
            username: this.config.username,
            clientId: this.clientId,
            data: {
                version: chrome.runtime.getManifest().version,
                platform: "chrome",
                userAgent: navigator.userAgent,
            },
        };

        this.send(message);
        this.addLog("send", "AUTH", "auth.login", message.data);
    }

    private handleMessage(message: CloudMessage): void {
        console.log("[CloudWS] Received message:", message);

        this.addLog("receive", message.type, message.action, message.data);

        const callbacks = this.listeners.get(message.type);
        callbacks?.forEach((cb) => cb(message.data));

        switch (message.type) {
            case "AUTH":
                this.handleAuthResponse(message.data);
                break;
            case "EXECUTE":
                this.handleExecuteRequest(message.data);
                break;
            case "HEARTBEAT":
                this.handleHeartbeat(message.data);
                break;
        }
    }

    private handleAuthResponse(data: any): void {
        if (data.success) {
            console.log("[CloudWS] Authentication successful");
            this.syncScripts();
        } else {
            console.error("[CloudWS] Authentication failed:", data.message);
        }
    }

    private async handleExecuteRequest(data: any): Promise<void> {
        try {
            const { taskId, scriptId: scriptKey, params } = data;
            const script = await this.getLocalScript(scriptKey);

            if (!script) {
                this.send({
                    id: this.generateMessageId(),
                    type: "EXECUTE",
                    action: "script.result",
                    timestamp: Date.now(),
                    username: this.config.username,
                    clientId: this.clientId,
                    data: {
                        taskId,
                        success: false,
                        error: `Script not found with key: ${scriptKey}`,
                        executionTime: 0,
                    },
                });
                return;
            }

            this.emit("execute", { taskId, scriptId: scriptKey, params, script });
        } catch (error: any) {
            this.send({
                id: this.generateMessageId(),
                type: "EXECUTE",
                action: "script.result",
                timestamp: Date.now(),
                username: this.config.username,
                clientId: this.clientId,
                data: {
                    taskId: data.taskId,
                    success: false,
                    error: error.message,
                    executionTime: 0,
                },
            });
        }
    }

    private handleHeartbeat(_data: any): void {
        this.status.lastHeartbeat = Date.now();
        this.notifyStatusChange();
    }

    private handleDisconnect(): void {
        this.status.connected = false;
        this.stopHeartbeat();
        this.stopScriptReport();
        this.notifyStatusChange();

        if (this.config.autoReconnect && this.status.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.status.reconnectAttempts++;
        const delay = this.config.reconnectInterval * 1000 * this.status.reconnectAttempts;

        console.log(`[CloudWS] Scheduling reconnect attempt ${this.status.reconnectAttempts} in ${delay}ms`);

        this.reconnectTimer = setTimeout(() => {
            this.connect().catch((error) => {
                console.error("[CloudWS] Reconnect failed:", error);
            });
        }, delay);
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.status.connected) {
                this.send({
                    id: this.generateMessageId(),
                    type: "HEARTBEAT",
                    action: "ping",
                    timestamp: Date.now(),
                    username: this.config.username,
                    clientId: this.clientId,
                    data: {},
                });
            }
        }, this.config.heartbeatInterval * 1000);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private startScriptReport(): void {
        this.stopScriptReport();
        this.syncScripts();

        this.reportTimer = setInterval(() => {
            this.syncScripts();
        }, 60000);
    }

    private stopScriptReport(): void {
        if (this.reportTimer) {
            clearInterval(this.reportTimer);
            this.reportTimer = null;
        }
    }

    async syncScripts(): Promise<void> {
        console.log("[CloudWS] syncScripts called");
        const scripts = await this.scriptFetcher();
        console.log("[CloudWS] scriptFetcher returned:", scripts.length, "scripts");
        console.log("[CloudWS] scriptConfigs size:", this.scriptConfigs.size);

        const enabledScripts = scripts.filter((script) => {
            const config = this.scriptConfigs.get(script.id);
            console.log("[CloudWS] Script:", script.id, script.name, "config:", config);
            return config === undefined || config.enabled;
        });

        console.log("[CloudWS] enabledScripts:", enabledScripts.length);

        const message: CloudMessage = {
            id: this.generateMessageId(),
            type: "SCRIPT_LIST",
            action: "script.sync",
            timestamp: Date.now(),
            username: this.config.username,
            clientId: this.clientId,
            data: {
                scripts: enabledScripts.map((script) => ({
                    id: script.id,
                    name: script.name,
                    version: script.metadata?.version || "1.0.0",
                    metadata: {
                        namespace: script.metadata?.namespace,
                        description: script.metadata?.description,
                        author: script.metadata?.author,
                        match: script.metadata?.match,
                        grant: script.metadata?.grant,
                        crontab: script.metadata?.crontab,
                        cloudCat: script.metadata?.cloudcat,
                        inputParams: script.metadata?.inputParams, // 包含输入参数示例
                    },
                })),
            },
        };

        this.send(message);
        this.addLog("send", "SCRIPT_LIST", "script.sync", { count: enabledScripts.length });
    }

    private async getLocalScript(scriptKey: string): Promise<any> {
        const scripts = await this.scriptFetcher();
        // scriptKey 就是脚本的 key（因为上报时使用 key 作为 id）
        return scripts.find((s) => s.key === scriptKey || s.id === scriptKey);
    }

    send(message: CloudMessage): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    disconnect(): void {
        this.stopHeartbeat();
        this.stopScriptReport();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.status.connected = false;
        this.status.connecting = false;
        this.notifyStatusChange();
    }

    private addLog(
        direction: "send" | "receive",
        type: string,
        action: string,
        data: any,
        success?: boolean,
        error?: string
    ): void {
        const log: CommunicationLog = {
            id: uuidv4(),
            timestamp: Date.now(),
            direction,
            type,
            action,
            data,
            success,
            error,
        };

        this.logs.unshift(log);

        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        this.emit("log", log);
    }

    getLogs(): CommunicationLog[] {
        return this.logs;
    }

    clearLogs(): void {
        this.logs = [];
        this.emit("logsCleared", {});
    }

    getStatus(): CloudConnectionStatus {
        return { ...this.status };
    }

    getConfig(): CloudConnectionConfig {
        return { ...this.config };
    }

    updateConfig(config: Partial<CloudConnectionConfig>): void {
        this.config = { ...this.config, ...config };

        if (config.autoReconnect !== undefined && !config.autoReconnect && this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    getClientId(): string {
        return this.clientId;
    }

    async setScriptReportConfig(scriptId: string, enabled: boolean): Promise<void> {
        const config = this.scriptConfigs.get(scriptId);

        if (config) {
            config.enabled = enabled;
        } else {
            this.scriptConfigs.set(scriptId, {
                scriptId,
                scriptName: "",
                enabled,
            });
        }

        await this.saveScriptConfigs();
    }

    getScriptReportConfig(scriptId: string): ScriptReportConfig | undefined {
        return this.scriptConfigs.get(scriptId);
    }

    getAllScriptConfigs(): ScriptReportConfig[] {
        return Array.from(this.scriptConfigs.values());
    }

    on(event: string, callback: (data: any) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    off(event: string, callback: (data: any) => void): void {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: string, data: any): void {
        const callbacks = this.listeners.get(event);
        callbacks?.forEach((cb) => cb(data));
    }

    private notifyStatusChange(): void {
        this.emit("statusChange", this.getStatus());
    }

    private generateMessageId(): string {
        return `msg-${Date.now()}-${uuidv4().substring(0, 8)}`;
    }
}
