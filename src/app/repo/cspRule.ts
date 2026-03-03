import { Repo } from "./repo";

export type CSPRuleAction = "remove" | "modify";

export interface CSPRule {
  id: string;
  name: string;
  description: string;
  path: string;
  action: CSPRuleAction;
  actionValue?: string;
  priority: number;
  enabled: boolean;
  createtime: number;
  updatetime: number;
}

export class CSPRuleDAO extends Repo<CSPRule> {
  constructor() {
    super("cspRule");
  }

  async getAllRules(): Promise<CSPRule[]> {
    const rules = await this.find();
    return rules.sort((a, b) => b.priority - a.priority);
  }

  async getEnabledRules(): Promise<CSPRule[]> {
    const rules = await this.find((_, value) => value.enabled === true);
    return rules.sort((a, b) => b.priority - a.priority);
  }

  async saveRule(rule: CSPRule): Promise<CSPRule> {
    return this._save(rule.id, rule);
  }

  async deleteRule(id: string): Promise<void> {
    return this.delete(id);
  }

  async updateRule(id: string, changes: Partial<CSPRule>): Promise<CSPRule | false> {
    return this.update(id, changes);
  }
}
