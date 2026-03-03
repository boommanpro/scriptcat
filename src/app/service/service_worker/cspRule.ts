import type { Group } from "@Packages/message/server";
import type { IMessageQueue } from "@Packages/message/message_queue";
import { CSPRuleDAO, type CSPRule } from "@App/app/repo/cspRule";
import Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";
import { v4 as uuidv4 } from "uuid";

export class CSPRuleService {
  private logger: Logger;
  private cspRuleDAO: CSPRuleDAO;

  constructor(private group: Group, private mq: IMessageQueue) {
    this.logger = LoggerCore.logger().with({ service: "cspRule" });
    this.cspRuleDAO = new CSPRuleDAO();
  }

  async getAllRules(): Promise<CSPRule[]> {
    return this.cspRuleDAO.getAllRules();
  }

  async getEnabledRules(): Promise<CSPRule[]> {
    return this.cspRuleDAO.getEnabledRules();
  }

  async createRule(rule: Omit<CSPRule, "id" | "createtime" | "updatetime">): Promise<CSPRule> {
    const now = Date.now();
    const newRule: CSPRule = {
      ...rule,
      id: uuidv4(),
      createtime: now,
      updatetime: now,
    };
    await this.cspRuleDAO.saveRule(newRule);
    this.logger.info("create csp rule", { name: rule.name, id: newRule.id });
    this.mq.publish<CSPRule[]>("cspRulesChanged", await this.getEnabledRules());
    return newRule;
  }

  async updateRule(params: { id: string; changes: Partial<CSPRule> }): Promise<CSPRule | false> {
    const { id, changes } = params;
    const result = await this.cspRuleDAO.updateRule(id, {
      ...changes,
      updatetime: Date.now(),
    });
    if (result) {
      this.logger.info("update csp rule", { id });
      this.mq.publish<CSPRule[]>("cspRulesChanged", await this.getEnabledRules());
    }
    return result;
  }

  async deleteRule(id: string): Promise<void> {
    await this.cspRuleDAO.deleteRule(id);
    this.logger.info("delete csp rule", { id });
    this.mq.publish<CSPRule[]>("cspRulesChanged", await this.getEnabledRules());
  }

  async toggleRule(params: { id: string; enabled: boolean }): Promise<CSPRule | false> {
    return this.updateRule({ id: params.id, changes: { enabled: params.enabled } });
  }

  async reorderRules(ruleIds: string[]): Promise<void> {
    const rules = await this.cspRuleDAO.getAllRules();
    for (let i = 0; i < ruleIds.length; i++) {
      const rule = rules.find((r) => r.id === ruleIds[i]);
      if (rule) {
        rule.priority = ruleIds.length - i;
        await this.cspRuleDAO.saveRule(rule);
      }
    }
    this.mq.publish<CSPRule[]>("cspRulesChanged", await this.getEnabledRules());
  }

  init() {
    this.group.on("getAllRules", this.getAllRules.bind(this));
    this.group.on("getEnabledRules", this.getEnabledRules.bind(this));
    this.group.on("createRule", this.createRule.bind(this));
    this.group.on("updateRule", this.updateRule.bind(this));
    this.group.on("deleteRule", this.deleteRule.bind(this));
    this.group.on("toggleRule", this.toggleRule.bind(this));
    this.group.on("reorderRules", this.reorderRules.bind(this));
  }
}
