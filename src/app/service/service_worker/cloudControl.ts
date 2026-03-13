import { CloudWebSocketClient } from "@App/pkg/cloud/CloudWebSocketClient";
import type { CloudConnectionConfig, ScriptFetcher } from "@App/pkg/cloud/CloudWebSocketClient";
import { AutomationScriptDAO } from "@App/app/repo/automationScript";
import type { Group } from "@Packages/message/server";
import type { IMessageQueue } from "@Packages/message/message_queue";
import { AutomationScriptService } from "./automationScript";

export class CloudControlBackgroundService {
  private client: CloudWebSocketClient | null = null;
  private config: CloudConnectionConfig | null = null;
  private automationScriptDAO: AutomationScriptDAO;
  private automationScriptService: AutomationScriptService | null = null;

  constructor(
    private group: Group,
    private mq: IMessageQueue
  ) {
    this.automationScriptDAO = new AutomationScriptDAO();
    this.config = null;
    this.client = null;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    this.automationScriptService = new AutomationScriptService(this.group, this.mq);
    await this.loadConfig();
    this.setupMessageListener();
  }

  private createScriptFetcher(): ScriptFetcher {
    return async () => {
      try {
        console.log("[CloudControl] ScriptFetcher called");
        const scripts = await this.automationScriptDAO.getAllScripts();
        console.log("[CloudControl] ScriptFetcher returned:", scripts.length, "scripts");

        // 使用 key 作为主要标识符上报给服务端
        return scripts.map((script) => ({
          id: script.key, // 使用 key 作为 id，确保服务端使用 key 来标识脚本
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
            inputParams: script.inputParams || "{}", // 包含输入参数示例
          },
        }));
      } catch (error) {
        console.error("[CloudControl] ScriptFetcher error:", error);
        return [];
      }
    };
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
        this.client = new CloudWebSocketClient(config, this.createScriptFetcher());
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
      console.log("[CloudControl] handleGetScripts called");
      const scripts = await this.automationScriptDAO.getAllScripts();
      console.log("[CloudControl] getAllScripts returned:", scripts.length, "scripts");

      // 使用 key 作为主要标识符
      const scriptConfigs = scripts.map((script) => ({
        id: script.key, // 使用 key 作为 id，保持一致性
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
      console.log("[CloudControl] Sending scriptConfigs:", scriptConfigs.length);
      sendResponse({ scripts: scriptConfigs });
    } catch (error: any) {
      console.error("[CloudControl] handleGetScripts error:", error);
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
      chrome.runtime
        .sendMessage({
          action: "cloud_status_change",
          status,
        })
        .catch(() => {});
    });

    this.client.on("log", (log) => {
      chrome.runtime
        .sendMessage({
          action: "cloud_log",
          log,
        })
        .catch(() => {});
    });

    this.client.on("execute", async (data) => {
      const { taskId, scriptId, params } = data;
      const startTime = Date.now();
      try {
        console.log("[CloudControl] Execute request received:", { taskId, scriptId, params });

        // scriptId 实际上是脚本的 key（因为上报时使用 key 作为 id）
        const scriptKey = scriptId;
        const script = await this.automationScriptDAO.getByKey(scriptKey);

        if (!script) {
          throw new Error(`Script not found with key: ${scriptKey}`);
        }

        console.log("[CloudControl] Found script:", { key: script.key, name: script.name });

        const result = await this.executeAutomationScript(script.key, params);
        const duration = Date.now() - startTime;

        console.log("[CloudControl] Execution result:", result);

        this.client?.send({
          id: `msg-${Date.now()}`,
          type: "EXECUTE",
          action: "script.result",
          timestamp: Date.now(),
          data: {
            taskId,
            success: result.success,
            result: result.result,
            error: result.error,
            executionTime: duration,
          },
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error("[CloudControl] Execution error:", error);
        this.client?.send({
          id: `msg-${Date.now()}`,
          type: "EXECUTE",
          action: "script.result",
          timestamp: Date.now(),
          data: {
            taskId,
            success: false,
            error: error.message,
            executionTime: duration,
          },
        });
      }
    });
  }

  private async executeAutomationScript(
    scriptKey: string,
    params: any
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    console.log(`[CloudControl] Executing automation script with key: ${scriptKey}`, params);

    if (!this.automationScriptService) {
      throw new Error("AutomationScriptService not initialized");
    }

    try {
      const result = await this.automationScriptService.executeScript(scriptKey, params);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async connect(): Promise<void> {
    if (this.config && this.config.serverUrl && this.config.username) {
      if (!this.client) {
        this.client = new CloudWebSocketClient(this.config, this.createScriptFetcher());
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
