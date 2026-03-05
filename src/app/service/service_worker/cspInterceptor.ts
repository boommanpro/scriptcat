import type { IMessageQueue } from "@Packages/message/message_queue";
import { CSPRuleDAO, type CSPRule } from "@App/app/repo/cspRule";
import type Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";

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

  private convertToDeclarativeRule(rule: CSPRule): hrome.declarativeNetRequest.Rule[] | null {
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

    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      const regexPattern = pattern.slice(1, -1);
      try {
        new RegExp(regexPattern);
        conditions.push({
          regexFilter: regexPattern,
        });
        this.logger.debug("using regex filter", { pattern, regexPattern });
      } catch (e) {
        this.logger.error("invalid regex pattern", { pattern, error: String(e) });
      }
    } else if (pattern === "*" || pattern === "*://*" || pattern === "*://*/*") {
      conditions.push({
        urlFilter: "*",
      });
      this.logger.debug("using wildcard for all urls", { pattern });
    } else if (pattern.startsWith("*://")) {
      const urlFilter = this.convertWildcardToUrlFilter(pattern);
      conditions.push({
        urlFilter: urlFilter,
      });
      this.logger.debug("using url filter from wildcard", { pattern, urlFilter });
    } else if (pattern.includes("*")) {
      const urlFilter = this.convertWildcardToUrlFilter(pattern);
      conditions.push({
        urlFilter: urlFilter,
      });
      this.logger.debug("using url filter from general wildcard", { pattern, urlFilter });
    } else {
      if (pattern.includes("://")) {
        conditions.push({
          urlFilter: `|${pattern}|`,
        });
      } else {
        conditions.push({
          urlFilter: `||${pattern}`,
        });
      }
      this.logger.debug("using exact/substring match", { pattern });
    }

    return conditions;
  }

  private convertWildcardToUrlFilter(pattern: string): string {
    let urlFilter = pattern;

    if (!urlFilter.includes("://")) {
      if (urlFilter.startsWith("*.")) {
        urlFilter = `*://${urlFilter}`;
      } else if (urlFilter.startsWith("*")) {
        urlFilter = `*://${urlFilter}`;
      } else {
        urlFilter = `*://${urlFilter}`;
      }
    }

    if (urlFilter.startsWith("*://")) {
      urlFilter = `*://${urlFilter.slice(4)}`;
    }

    urlFilter = urlFilter
      .replace(/^(\*):\/\//, "*://")
      .replace(/\.\*/g, "*")
      .replace(/\.\?/g, "?");

    if (!urlFilter.endsWith("*") && !urlFilter.endsWith("|")) {
      if (urlFilter.includes("/")) {
        const lastSlash = urlFilter.lastIndexOf("/");
        const afterSlash = urlFilter.slice(lastSlash + 1);
        if (afterSlash && !afterSlash.includes("*")) {
          urlFilter = urlFilter + "*";
        }
      } else {
        urlFilter = urlFilter + "/*";
      }
    }

    return urlFilter;
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
