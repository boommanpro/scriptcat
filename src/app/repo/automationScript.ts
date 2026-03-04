import { Repo } from "./repo";

export interface AutomationTestLog {
  id: string;
  scriptKey: string;
  testTaskId?: string;
  inputJson: string;
  outputJson?: string;
  status: "success" | "error" | "running";
  error?: string;
  createtime: number;
  duration?: number;
  scriptContent?: string;
}

export interface AutomationScript {
  id: string;
  key: string;
  name: string;
  description: string;
  targetUrl: string;
  script: string;
  enabled: boolean;
  waitForResponse: boolean;
  responseTimeout: number;
  createtime: number;
  updatetime: number;
}

export class AutomationScriptDAO extends Repo<AutomationScript> {
  constructor() {
    super("automationScript");
  }

  async getAllScripts(): Promise<AutomationScript[]> {
    const scripts = await this.find();
    return scripts.sort((a, b) => a.createtime - b.createtime);
  }

  async getEnabledScripts(): Promise<AutomationScript[]> {
    const scripts = await this.find((_, value) => value.enabled === true);
    return scripts.sort((a, b) => a.createtime - b.createtime);
  }

  async getByKey(key: string): Promise<AutomationScript | undefined> {
    return this.findOne((k, value) => value.key === key);
  }

  async saveScript(script: AutomationScript): Promise<AutomationScript> {
    return this._save(script.id, script);
  }

  async deleteScript(id: string): Promise<void> {
    return this.delete(id);
  }

  async updateScript(id: string, changes: Partial<AutomationScript>): Promise<AutomationScript | false> {
    return this.update(id, changes);
  }
}

export class AutomationTestLogDAO extends Repo<AutomationTestLog> {
  constructor() {
    super("automationTestLog");
  }

  async getLogsByScriptKey(scriptKey: string, limit: number = 50): Promise<AutomationTestLog[]> {
    const logs = await this.find((_, value) => value.scriptKey === scriptKey);
    return logs.sort((a, b) => b.createtime - a.createtime).slice(0, limit);
  }

  async getLogByTestTaskId(testTaskId: string): Promise<AutomationTestLog | undefined> {
    return this.findOne((_, value) => value.testTaskId === testTaskId);
  }

  async saveLog(log: AutomationTestLog): Promise<AutomationTestLog> {
    return this._save(log.id, log);
  }

  async deleteLog(id: string): Promise<void> {
    return this.delete(id);
  }

  async deleteLogsByScriptKey(scriptKey: string): Promise<void> {
    const logs = await this.find((_, value) => value.scriptKey === scriptKey);
    for (const log of logs) {
      await this.delete(log.id);
    }
  }

  async clearOldLogs(scriptKey: string, keepCount: number = 100): Promise<void> {
    const logs = await this.find((_, value) => value.scriptKey === scriptKey);
    const sortedLogs = logs.sort((a, b) => b.createtime - a.createtime);
    const toDelete = sortedLogs.slice(keepCount);
    for (const log of toDelete) {
      await this.delete(log.id);
    }
  }
}
