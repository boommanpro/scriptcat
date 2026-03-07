import type { IMessageQueue } from "@Packages/message/message_queue";
import { CSPRuleDAO, type CSPRule } from "@App/app/repo/cspRule";
import type Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";
import { PatternMatcher } from "@App/pkg/utils/patternMatcher";

const CSP_RULE_ID_START = 10000;
const MAX_DYNAMIC_RULES = 5000;

export class CSPInterceptorService {
  private logger: Logger;
  private cspRuleDAO: CSPRuleDAO;
  private enabledRules: CSPRule[] = [];
  private initialized: boolean = false;
  private ruleIdCounter: number = CSP_RULE_ID_START;

  constructor(private mq: IMessageQueue) {
    this.logger = LoggerCore.logger().with({ service: "cspInterceptor" });
    this.cspRuleDAO = new CSPRuleDAO();
  }

  async init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    this.enabledRules = await this.cspRuleDAO.getEnabledRules();
    this.logger.info("csp interceptor initialized", { ruleCount: this.enabledRules.length });

    await this.updateDeclarativeRules();

    this.mq.subscribe<CSPRule[]>("cspRulesChanged", async (rules) => {
      this.enabledRules = rules;
      this.logger.info("csp rules updated", { ruleCount: rules.length });
      await this.updateDeclarativeRules();
    });
  }

  private async updateDeclarativeRules() {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules
        .filter((rule) => rule.id >= CSP_RULE_ID_START && rule.id < CSP_RULE_ID_START + MAX_DYNAMIC_RULES)
        .map((rule) => rule.id);

      this.logger.info("existing csp rules to remove", { count: existingRuleIds.length });

      const newRules: chrome.declarativeNetRequest.Rule[] = [];
      this.ruleIdCounter = CSP_RULE_ID_START;

      const sortedRules = [...this.enabledRules].sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        const dnrRules = this.convertToDeclarativeRule(rule);
        if (dnrRules) {
          for (const dnrRule of dnrRules) {
            if (newRules.length >= MAX_DYNAMIC_RULES) {
              this.logger.warn("max dynamic rules limit reached", { limit: MAX_DYNAMIC_RULES });
              break;
            }
            newRules.push(dnrRule);
          }
        }
        if (newRules.length >= MAX_DYNAMIC_RULES) {
          break;
        }
      }

      this.logger.info("updating declarative rules", {
        removeCount: existingRuleIds.length,
        addCount: newRules.length,
      });

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: newRules,
      });

      this.logger.info("declarative rules updated successfully");
    } catch (e) {
      this.logger.error("failed to update declarative rules", { error: String(e) });
    }
  }

  private convertToDeclarativeRule(rule: CSPRule): chrome.declarativeNetRequest.Rule[] | null {
    if (!rule.enabled) {
      return null;
    }

    const conditions = this.buildConditions(rule.path);
    if (conditions.length === 0) {
      this.logger.warn("could not build condition for rule", { ruleName: rule.name, path: rule.path });
      return null;
    }

    const dnrRules: chrome.declarativeNetRequest.Rule[] = [];

    for (const condition of conditions) {
      const ruleId = this.ruleIdCounter++;

      if (rule.action === "remove") {
        dnrRules.push({
          id: ruleId,
          priority: rule.priority,
          action: {
            type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
            responseHeaders: [
              {
                header: "Content-Security-Policy",
                operation: "remove" as chrome.declarativeNetRequest.HeaderOperation,
              },
              {
                header: "Content-Security-Policy-Report-Only",
                operation: "remove" as chrome.declarativeNetRequest.HeaderOperation,
              },
              {
                header: "X-Content-Security-Policy",
                operation: "remove" as chrome.declarativeNetRequest.HeaderOperation,
              },
              {
                header: "X-WebKit-CSP",
                operation: "remove" as chrome.declarativeNetRequest.HeaderOperation,
              },
            ],
          },
          condition: {
            ...condition,
            resourceTypes: ["main_frame", "sub_frame"] as chrome.declarativeNetRequest.ResourceType[],
          },
        });
      } else if (rule.action === "modify" && rule.actionValue) {
        dnrRules.push({
          id: ruleId,
          priority: rule.priority,
          action: {
            type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
            responseHeaders: [
              {
                header: "Content-Security-Policy",
                operation: "set" as chrome.declarativeNetRequest.HeaderOperation,
                value: rule.actionValue,
              },
            ],
          },
          condition: {
            ...condition,
            resourceTypes: ["main_frame", "sub_frame"] as chrome.declarativeNetRequest.ResourceType[],
          },
        });
      }
    }

    return dnrRules;
  }

  private buildConditions(pattern: string): Partial<chrome.declarativeNetRequest.RuleCondition>[] {
    const conditions: Partial<chrome.declarativeNetRequest.RuleCondition>[] = [];

    const filter = PatternMatcher.toDeclarativeNetRequestFilter(pattern);
    if (!filter) {
      this.logger.warn("invalid pattern", { pattern });
      return conditions;
    }

    if (filter.regexFilter) {
      conditions.push({
        regexFilter: filter.regexFilter,
      });
      this.logger.debug("using regex filter", { pattern, regexFilter: filter.regexFilter });
    } else if (filter.urlFilter) {
      conditions.push({
        urlFilter: filter.urlFilter,
      });
      this.logger.debug("using url filter", { pattern, urlFilter: filter.urlFilter });
    }

    return conditions;
  }

  async addRule(_rule: CSPRule): Promise<void> {
    await this.updateDeclarativeRules();
  }

  async removeRule(_ruleId: string): Promise<void> {
    await this.updateDeclarativeRules();
  }

  async updateRule(_rule: CSPRule): Promise<void> {
    await this.updateDeclarativeRules();
  }
}
