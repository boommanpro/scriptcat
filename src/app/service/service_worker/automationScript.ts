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
    waitForResponse?: boolean;
    responseTimeout?: number;
  }): Promise<AutomationTestLog> {
    const { scriptKey, inputJson, tabId, scriptContent, waitForResponse, responseTimeout } = params;
    const script = await this.getByKey(scriptKey);
    if (!script) {
      throw new Error("Script not found");
    }

    const actualScriptContent = scriptContent || script.script;
    const actualWaitForResponse = waitForResponse !== undefined ? waitForResponse : script.waitForResponse;
    const actualResponseTimeout = responseTimeout !== undefined ? responseTimeout : script.responseTimeout;

    const startTime = Date.now();
    const testTaskId = uuidv4();

    console.log("=== [AutomationScript] Test Execution Start ===");
    console.log(`[${new Date().toISOString()}] Test execution initiated`);
    console.log("Script Key:", scriptKey);
    console.log("Test Task ID:", testTaskId);
    console.log("Target Tab ID:", tabId || "(will be determined)");
    console.log("--- Script Content ---");
    console.log(actualScriptContent);
    console.log("--- End Script Content ---");
    console.log("--- Input Parameters ---");
    console.log("Raw Input JSON:", inputJson);
    console.log("--- End Input Parameters ---");
    console.log("--- Configuration ---");
    console.log("waitForResponse:", actualWaitForResponse);
    console.log("responseTimeout:", actualResponseTimeout, "ms");
    console.log("Target URL:", script.targetUrl || "(not set)");
    console.log("--- End Configuration ---");

    const log = await this.createTestLog({
      scriptKey,
      testTaskId,
      inputJson,
      status: "running",
      scriptContent: actualScriptContent,
      waitForResponse: actualWaitForResponse,
      responseTimeout: actualResponseTimeout,
    });

    console.log("Test log created with ID:", log.id);

    try {
      let inputData: any;
      try {
        inputData = JSON.parse(inputJson);
        console.log("Parsed input data:", JSON.stringify(inputData, null, 2));
      } catch (parseError: any) {
        console.error("Failed to parse input JSON:", parseError.message);
        throw new Error("Invalid input JSON");
      }

      inputData.testTaskId = testTaskId;
      console.log("Input data with testTaskId:", JSON.stringify(inputData, null, 2));

      let targetTabId = tabId;

      if (!targetTabId) {
        if (script.targetUrl) {
          console.log("Creating new tab with target URL:", script.targetUrl);
          const tab = await chrome.tabs.create({ url: script.targetUrl, active: false });
          targetTabId = tab.id;
          console.log("Waiting for tab to complete loading, tabId:", targetTabId);
          await this.waitForTabComplete(targetTabId!);
          console.log("Tab loaded successfully");
        } else {
          console.log("Using active tab as target");
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab || !activeTab.id) {
            throw new Error("No active tab found");
          }
          targetTabId = activeTab.id;
        }
      }

      console.log("Final target tab ID:", targetTabId);

      const config: PostMessageConfig = {
        waitForMessage: actualWaitForResponse || false,
        timeout: actualResponseTimeout || 30000,
        testTaskId,
      };

      console.log("--- Executing Script ---");
      console.log("PostMessageConfig:", JSON.stringify(config, null, 2));
      console.log("Execution world: MAIN");

      const result = await this.executeScriptInTab(targetTabId!, actualScriptContent, inputData, config);
      const duration = Date.now() - startTime;

      console.log("--- Execution Result ---");
      console.log("Duration:", duration, "ms");
      console.log("Success:", result.success);
      if (result.result) {
        console.log("Result:", JSON.stringify(result.result, null, 2));
      }
      if (result.error) {
        console.log("Error:", result.error);
        console.log("Error Type:", result.errorType);
      }
      if (result.source) {
        console.log("Message Source:", result.source);
      }
      console.log("--- End Execution Result ---");

      if (!result.success) {
        throw new Error(result.error || "Script execution failed");
      }

      const updatedLog = await this.testLogDAO.update(log.id, {
        status: "success",
        outputJson: JSON.stringify(result.result, null, 2),
        duration,
      });

      console.log("=== [AutomationScript] Test Execution Success ===");
      this.logger.info("automation test success", { scriptKey, duration, testTaskId });
      return updatedLog || log;
    } catch (e: any) {
      const duration = Date.now() - startTime;
      console.error("--- Test Execution Error ---");
      console.error("Error Type:", e.constructor?.name || "Unknown");
      console.error("Error Message:", e.message);
      console.error("Error Stack:", e.stack);
      console.error("Duration:", duration, "ms");
      console.error("=== [AutomationScript] Test Execution Failed ===");

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

      const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
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
    console.log("--- [executeScriptInTab] Starting ---");
    console.log("Tab ID:", tabId);
    console.log("Input:", JSON.stringify(input, null, 2));

    try {
      const config: PostMessageConfig = {
        timeout: postMessageConfig?.timeout || 30000,
        waitForMessage: postMessageConfig?.waitForMessage || false,
        testTaskId: postMessageConfig?.testTaskId,
      };

      console.log("PostMessage Config:", JSON.stringify(config, null, 2));
      console.log("waitForMessage mode:", config.waitForMessage ? "ENABLED" : "DISABLED");

      const wrappedCode = `
        return (async function(input) {
          ${scriptCode}
        })(${JSON.stringify(input)});
      `;

      console.log("Wrapped code prepared, length:", wrappedCode.length);
      console.log("Executing script in MAIN world...");

      const result = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (codeToExecute: string, pmConfig: PostMessageConfig) => {
          try {
            console.log("[Page Context] Script execution started");
            console.log("[Page Context] waitForMessage:", pmConfig.waitForMessage);
            console.log("[Page Context] testTaskId:", pmConfig.testTaskId);
            console.log("[Page Context] timeout:", pmConfig.timeout);

            if (pmConfig.waitForMessage) {
              console.log("[Page Context] Setting up postMessage listener...");
              return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                  window.removeEventListener("message", messageHandler);
                  const errorMsg = pmConfig.testTaskId
                    ? `PostMessage timeout (testTaskId: ${pmConfig.testTaskId})`
                    : "PostMessage timeout";
                  console.error("[Page Context] PostMessage timeout!");
                  resolve({
                    success: false,
                    error: errorMsg,
                    errorType: "TimeoutError",
                  });
                }, pmConfig.timeout);

                const messageHandler = (event: MessageEvent) => {
                  console.log("[Page Context] Received message:", event.data);
                  if (!event.data || typeof event.data !== "object") {
                    console.log("[Page Context] Ignoring non-object message");
                    return;
                  }

                  if (pmConfig.testTaskId && event.data.testTaskId !== pmConfig.testTaskId) {
                    console.log("[Page Context] Ignoring message with different testTaskId");
                    return;
                  }

                  clearTimeout(timeout);
                  window.removeEventListener("message", messageHandler);
                  console.log("[Page Context] PostMessage received, resolving with:", event.data);

                  resolve({
                    success: true,
                    result: event.data,
                    source: event.origin,
                  });
                };

                window.addEventListener("message", messageHandler);

                try {
                  const fn = new Function(codeToExecute);
                  console.log("[Page Context] Executing script function...");
                  const scriptResult = fn();
                  console.log("[Page Context] Script function returned:", typeof scriptResult);

                  if (scriptResult instanceof Promise) {
                    console.log("[Page Context] Script returned a Promise, waiting...");
                    scriptResult
                      .then((ret) => {
                        console.log("[Page Context] Promise resolved with:", ret);
                        if (ret !== undefined && ret !== null) {
                          clearTimeout(timeout);
                          window.removeEventListener("message", messageHandler);
                          console.log("[Page Context] Using Promise return value instead of waiting for postMessage");
                          resolve({
                            success: true,
                            result: ret,
                          });
                        } else {
                          console.log("[Page Context] Promise returned null/undefined, waiting for postMessage...");
                        }
                      })
                      .catch((err) => {
                        clearTimeout(timeout);
                        window.removeEventListener("message", messageHandler);
                        console.error("[Page Context] Promise rejected:", err);
                        resolve({
                          success: false,
                          error: String(err),
                          errorType: err?.constructor?.name || "Error",
                        });
                      });
                  } else if (scriptResult !== undefined && scriptResult !== null) {
                    clearTimeout(timeout);
                    window.removeEventListener("message", messageHandler);
                    console.log("[Page Context] Script returned synchronously:", scriptResult);
                    resolve({
                      success: true,
                      result: scriptResult,
                    });
                  } else {
                    console.log("[Page Context] Script returned null/undefined, waiting for postMessage...");
                  }
                } catch (err: any) {
                  clearTimeout(timeout);
                  window.removeEventListener("message", messageHandler);
                  console.error("[Page Context] Script execution error:", err);
                  resolve({
                    success: false,
                    error: String(err),
                    errorType: err?.constructor?.name || "Error",
                  });
                }
              });
            }

            console.log("[Page Context] Running in direct return mode (no postMessage waiting)");
            const fn = new Function(codeToExecute);
            const result = fn();
            console.log("[Page Context] Direct execution result:", result);
            if (result instanceof Promise) {
              return result.then((r: any) => {
                console.log("[Page Context] Promise resolved:", r);
                return { success: true, result: r };
              });
            }
            return { success: true, result };
          } catch (error: any) {
            console.error("[Page Context] Execution error:", error);
            return { success: false, error: String(error), errorType: error.constructor.name };
          }
        },
        args: [wrappedCode, config],
      });

      console.log("Script execution completed");
      console.log("Raw result from chrome.scripting:", JSON.stringify(result, null, 2));

      const rawResult = result[0]?.result;
      let finalResult: ExecuteResult;
      if (rawResult && typeof rawResult === "object" && "success" in rawResult) {
        finalResult = rawResult as ExecuteResult;
      } else {
        finalResult = { success: false, error: "No result returned" };
      }
      console.log("Final result:", JSON.stringify(finalResult, null, 2));
      console.log("--- [executeScriptInTab] End ---");

      return finalResult;
    } catch (error: any) {
      console.error("[executeScriptInTab] Chrome scripting error:", error);
      return { success: false, error: error.message };
    }
  }

  async executeScript(scriptKey: string, input: any, tabId?: number): Promise<ExecuteResult> {
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
