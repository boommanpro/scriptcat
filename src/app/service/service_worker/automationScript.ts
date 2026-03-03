import type { Group } from "@Packages/message/server";
import type { IMessageQueue } from "@Packages/message/message_queue";
import {
  AutomationScriptDAO,
  AutomationTestLogDAO,
  type AutomationScript,
  type AutomationTestLog,
} from "@App/app/repo/automationScript";
import Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";
import { v4 as uuidv4 } from "uuid";

export class AutomationScriptService {
  private logger: Logger;
  private scriptDAO: AutomationScriptDAO;
  private testLogDAO: AutomationTestLogDAO;

  constructor(private group: Group, private mq: IMessageQueue) {
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

  async createScript(
    script: Omit<AutomationScript, "id" | "createtime" | "updatetime">
  ): Promise<AutomationScript> {
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

  async runTest(params: { scriptKey: string; inputJson: string }): Promise<AutomationTestLog> {
    const { scriptKey, inputJson } = params;
    const script = await this.getByKey(scriptKey);
    if (!script) {
      throw new Error("Script not found");
    }

    const startTime = Date.now();
    const log = await this.createTestLog({
      scriptKey,
      inputJson,
      status: "running",
    });

    try {
      let inputData: any;
      try {
        inputData = JSON.parse(inputJson);
      } catch (e) {
        throw new Error("Invalid input JSON");
      }

      const result = await this.executeScript(script, inputData);
      const duration = Date.now() - startTime;

      const updatedLog = await this.testLogDAO.update(log.id, {
        status: "success",
        outputJson: JSON.stringify(result, null, 2),
        duration,
      });

      this.logger.info("automation test success", { scriptKey, duration });
      return updatedLog || log;
    } catch (e: any) {
      const duration = Date.now() - startTime;
      const updatedLog = await this.testLogDAO.update(log.id, {
        status: "error",
        error: e.message || String(e),
        duration,
      });

      this.logger.error("automation test error", { scriptKey, error: e.message });
      return updatedLog || log;
    }
  }

  private async executeScript(script: AutomationScript, input: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const wrappedScript = `
          (async function(input) {
            ${script.script}
          })(arguments[0]).then(arguments[1]).catch(arguments[2]);
        `;
        const func = new Function("input", "resolve", "reject", wrappedScript);
        func(input, resolve, reject);
      } catch (e: any) {
        reject(e);
      }
    });
  }

  async openTargetPage(scriptKey: string): Promise<void> {
    const script = await this.getByKey(scriptKey);
    if (!script) {
      throw new Error("Script not found");
    }
    if (!script.targetUrl) {
      throw new Error("Script has no target URL");
    }
    await chrome.tabs.create({ url: script.targetUrl });
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
    this.group.on("createTestLog", this.createTestLog.bind(this));
    this.group.on("updateTestLog", this.updateTestLog.bind(this));
    this.group.on("deleteTestLog", this.deleteTestLog.bind(this));
    this.group.on("runTest", this.runTest.bind(this));
    this.group.on("openTargetPage", this.openTargetPage.bind(this));
  }
}
