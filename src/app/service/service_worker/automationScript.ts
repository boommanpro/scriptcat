import type { Group } from "@Packages/message/server";
import type { IMessageQueue } from "@Packages/message/message_queue";
import {
  AutomationScriptDAO,
  AutomationTestLogDAO,
  type AutomationScript,
  type AutomationTestLog,
} from "@App/app/repo/automationScript";
import type Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";
import { v4 as uuidv4 } from "uuid";

export interface ExecuteResult {
  success: boolean;
  result?: any;
  error?: string;
  errorType?: string;
  source?: string;
}

export interface PostMessageConfig {
  timeout?: number;
  waitForMessage?: boolean;
  testTaskId?: string;
}

export class AutomationScriptService {
  private logger: Logger;
  private scriptDAO: AutomationScriptDAO;
  private testLogDAO: AutomationTestLogDAO;

  constructor(
    private group: Group,
    private mq: IMessageQueue
  ) {
    this.logger = LoggerCore.logger().with({ service: "automationScript" });
    this.scriptDAO = new AutomationScriptDAO();
    this.testLogDAO = new AutomationTestLogDAO();
  }

  async getAllScripts(): Promise<AutomationScript[]> {
    return this.scriptDAO.getAllScripts();
  }

  async getEnabledScripts(): Promise<AutomationScript[]> {
    return this.scriptDAO.getEnabledScripts();
  }

  async getByKey(key: string): Promise<AutomationScript | undefined> {
    return this.scriptDAO.getByKey(key);
  }

  async createScript(script: Omit<AutomationScript, "id" | "createtime" | "updatetime">): Promise<AutomationScript> {
    const existing = await this.scriptDAO.getByKey(script.key);
    if (existing) {
      throw new Error("Script key already exists");
    }
    const now = Date.now();
    const newScript: AutomationScript = {
      ...script,
      id: uuidv4(),
      createtime: now,
      updatetime: now,
    };
    await this.scriptDAO.saveScript(newScript);
    this.logger.info("create automation script", { name: script.name, key: script.key, id: newScript.id });
    return newScript;
  }

  async updateScript(params: { id: string; changes: Partial<AutomationScript> }): Promise<AutomationScript | false> {
    const { id, changes } = params;
    if (changes.key) {
      const existing = await this.scriptDAO.getByKey(changes.key);
      if (existing && existing.id !== id) {
        throw new Error("Script key already exists");
      }
    }
    const result = await this.scriptDAO.updateScript(id, {
      ...changes,
      updatetime: Date.now(),
    });
    if (result) {
      this.logger.info("update automation script", { id });
    }
    return result;
  }

  async deleteScript(id: string): Promise<void> {
    const script = await this.scriptDAO.find((_, value) => value.id === id);
    if (script && script.length > 0) {
      await this.testLogDAO.deleteLogsByScriptKey(script[0].key);
    }
    await this.scriptDAO.deleteScript(id);
    this.logger.info("delete automation script", { id });
  }

  async toggleScript(params: { id: string; enabled: boolean }): Promise<AutomationScript | false> {
    return this.updateScript({ id: params.id, changes: { enabled: params.enabled } });
  }

  async getTestLogs(params: { scriptKey: string; limit?: number }): Promise<AutomationTestLog[]> {
    return this.testLogDAO.getLogsByScriptKey(params.scriptKey, params.limit || 50);
  }

  async getTestLogByTaskId(testTaskId: string): Promise<AutomationTestLog | undefined> {
    return this.testLogDAO.getLogByTestTaskId(testTaskId);
  }

  async createTestLog(log: Omit<AutomationTestLog, "id" | "createtime">): Promise<AutomationTestLog> {
    const newLog: AutomationTestLog = {
      ...log,
      id: uuidv4(),
      createtime: Date.now(),
    };
    await this.testLogDAO.saveLog(newLog);
    await this.testLogDAO.clearOldLogs(log.scriptKey, 100);
    return newLog;
  }

  async updateTestLog(params: { id: string; changes: Partial<AutomationTestLog> }): Promise<AutomationTestLog | false> {
    return this.testLogDAO.update(params.id, params.changes);
  }

  async deleteTestLog(id: string): Promise<void> {
    return this.testLogDAO.deleteLog(id);
  }

  async getActiveTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({ active: false });
    return tabs.filter((tab) => tab.url && !tab.url.startsWith("chrome://"));
  }

  async runTest(params: {
    scriptKey: string;
    inputJson: string;
    tabId?: number;
    scriptContent?: string;
  }): Promise<AutomationTestLog> {
    const { scriptKey, inputJson, tabId, scriptContent } = params;
    const script = await this.getByKey(scriptKey);
    if (!script) {
      throw new Error("Script not found");
    }

    const actualScriptContent = scriptContent || script.script;
    const startTime = Date.now();
    const testTaskId = uuidv4();
    const log = await this.createTestLog({
      scriptKey,
      testTaskId,
      inputJson,
      status: "running",
      scriptContent: actualScriptContent,
    });

    try {
      let inputData: any;
      try {
        inputData = JSON.parse(inputJson);
      } catch {
        throw new Error("Invalid input JSON");
      }

      inputData.testTaskId = testTaskId;

      let targetTabId = tabId;

      if (!targetTabId) {
        if (script.targetUrl) {
          const tab = await chrome.tabs.create({ url: script.targetUrl, active: false });
          targetTabId = tab.id;
          await this.waitForTabComplete(targetTabId!);
        } else {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab || !activeTab.id) {
            throw new Error("No active tab found");
          }
          targetTabId = activeTab.id;
        }
      }

      const config: PostMessageConfig = {
        waitForMessage: script.waitForResponse || false,
        timeout: script.responseTimeout || 30000,
        testTaskId,
      };

      const result = await this.executeScriptInTab(targetTabId!, actualScriptContent, inputData, config);
      const duration = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.error || "Script execution failed");
      }

      const updatedLog = await this.testLogDAO.update(log.id, {
        status: "success",
        outputJson: JSON.stringify(result.result, null, 2),
        duration,
      });

      this.logger.info("automation test success", { scriptKey, duration, testTaskId });
      return updatedLog || log;
    } catch (e: any) {
      const duration = Date.now() - startTime;
      const updatedLog = await this.testLogDAO.update(log.id, {
        status: "error",
        error: e.message || String(e),
        duration,
      });

      this.logger.error("automation test error", { scriptKey, error: e.message, testTaskId });
      return updatedLog || log;
    }
  }

  private waitForTabComplete(tabId: number, timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("Tab load timeout"));
      }, timeout);

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  private async executeScriptInTab(
    tabId: number,
    scriptCode: string,
    input: any,
    postMessageConfig?: PostMessageConfig
  ): Promise<ExecuteResult> {
    try {
      const config: PostMessageConfig = {
        timeout: postMessageConfig?.timeout || 30000,
        waitForMessage: postMessageConfig?.waitForMessage || false,
        testTaskId: postMessageConfig?.testTaskId,
      };

      const wrappedCode = `
        return (async function(input) {
          ${scriptCode}
        })(${JSON.stringify(input)});
      `;

      const result = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (codeToExecute: string, pmConfig: PostMessageConfig) => {
          try {
            if (pmConfig.waitForMessage) {
              return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                  window.removeEventListener("message", messageHandler);
                  const errorMsg = pmConfig.testTaskId
                    ? `PostMessage timeout (testTaskId: ${pmConfig.testTaskId})`
                    : "PostMessage timeout";
                  resolve({
                    success: false,
                    error: errorMsg,
                    errorType: "TimeoutError",
                  });
                }, pmConfig.timeout);

                const messageHandler = (event: MessageEvent) => {
                  if (!event.data || typeof event.data !== "object") {
                    return;
                  }

                  if (pmConfig.testTaskId && event.data.testTaskId !== pmConfig.testTaskId) {
                    return;
                  }

                  clearTimeout(timeout);
                  window.removeEventListener("message", messageHandler);

                  resolve({
                    success: true,
                    result: event.data,
                    source: event.origin,
                  });
                };

                window.addEventListener("message", messageHandler);

                const fn = new Function(codeToExecute);
                const scriptResult = fn();

                if (scriptResult instanceof Promise) {
                  scriptResult.catch((err) => {
                    clearTimeout(timeout);
                    window.removeEventListener("message", messageHandler);
                    resolve({
                      success: false,
                      error: String(err),
                      errorType: err.constructor.name,
                    });
                  });
                }
              });
            }

            const fn = new Function(codeToExecute);
            const result = fn();
            if (result instanceof Promise) {
              return result.then((r: any) => ({ success: true, result: r }));
            }
            return { success: true, result };
          } catch (error: any) {
            return { success: false, error: String(error), errorType: error.constructor.name };
          }
        },
        args: [wrappedCode, config],
      });

      return result[0]?.result || { success: false, error: "No result returned" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async executeScript(
    scriptKey: string,
    input: any,
    tabId?: number
  ): Promise<ExecuteResult> {
    const script = await this.getByKey(scriptKey);
    if (!script) {
      throw new Error("Script not found");
    }

    const testTaskId = uuidv4();
    const inputWithTaskId = {
      ...input,
      testTaskId,
    };

    let targetTabId = tabId;

    if (!targetTabId) {
      if (script.targetUrl) {
        const tab = await chrome.tabs.create({ url: script.targetUrl, active: false });
        targetTabId = tab.id;
        await this.waitForTabComplete(targetTabId!);
      } else {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.id) {
          throw new Error("No active tab found");
        }
        targetTabId = activeTab.id;
      }
    }

    const config: PostMessageConfig = {
      waitForMessage: script.waitForResponse || false,
      timeout: script.responseTimeout || 30000,
      testTaskId,
    };

    return this.executeScriptInTab(targetTabId!, script.script, inputWithTaskId, config);
  }

  async openTargetPage(scriptKey: string): Promise<number> {
    const script = await this.getByKey(scriptKey);
    if (!script) {
      throw new Error("Script not found");
    }
    if (!script.targetUrl) {
      throw new Error("Script has no target URL");
    }
    const tab = await chrome.tabs.create({ url: script.targetUrl });
    return tab.id!;
  }

  init() {
    this.group.on("getAllScripts", this.getAllScripts.bind(this));
    this.group.on("getEnabledScripts", this.getEnabledScripts.bind(this));
    this.group.on("getByKey", this.getByKey.bind(this));
    this.group.on("createScript", this.createScript.bind(this));
    this.group.on("updateScript", this.updateScript.bind(this));
    this.group.on("deleteScript", this.deleteScript.bind(this));
    this.group.on("toggleScript", this.toggleScript.bind(this));
    this.group.on("getTestLogs", this.getTestLogs.bind(this));
    this.group.on("getTestLogByTaskId", this.getTestLogByTaskId.bind(this));
    this.group.on("createTestLog", this.createTestLog.bind(this));
    this.group.on("updateTestLog", this.updateTestLog.bind(this));
    this.group.on("deleteTestLog", this.deleteTestLog.bind(this));
    this.group.on("runTest", this.runTest.bind(this));
    this.group.on("openTargetPage", this.openTargetPage.bind(this));
    this.group.on("getActiveTabs", this.getActiveTabs.bind(this));
    this.group.on("executeScript", this.executeScript.bind(this));
  }
}
