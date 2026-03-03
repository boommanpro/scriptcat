import type { IMessageQueue } from "@Packages/message/message_queue";
import { CSPRuleDAO, type CSPRule } from "@App/app/repo/cspRule";
import Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";

export class CSPInterceptorService {
  private logger: Logger;
  private cspRuleDAO: CSPRuleDAO;
  private enabledRules: CSPRule[] = [];
  private initialized: boolean = false;

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

    this.mq.subscribe<CSPRule[]>("cspRulesChanged", (rules) => {
      this.enabledRules = rules;
      this.logger.info("csp rules updated", { ruleCount: rules.length });
    });

    chrome.webRequest.onHeadersReceived.addListener(
      this.handleHeadersReceived.bind(this),
      { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
      ["blocking", "responseHeaders"]
    );
  }

  private handleHeadersReceived(details: chrome.webRequest.OnHeadersReceivedDetails): chrome.webRequest.BlockingResponse | undefined {
    if (!this.enabledRules.length) {
      return undefined;
    }

    const url = new URL(details.url);
    const matchingRules = this.enabledRules.filter((rule) => this.matchRule(rule, url.href, url.hostname));

    if (!matchingRules.length) {
      return undefined;
    }

    const responseHeaders = details.responseHeaders ? [...details.responseHeaders] : [];
    let modified = false;

    for (const rule of matchingRules) {
      const cspHeaderIndex = responseHeaders.findIndex(
        (h) => h.name.toLowerCase() === "content-security-policy"
      );

      if (rule.action === "remove") {
        if (cspHeaderIndex !== -1) {
          responseHeaders.splice(cspHeaderIndex, 1);
          modified = true;
          this.logger.debug("removed csp header", { url: details.url, rule: rule.name });
        }
      } else if (rule.action === "modify" && rule.actionValue) {
        if (cspHeaderIndex !== -1) {
          const originalCSP = responseHeaders[cspHeaderIndex].value || "";
          const modifiedCSP = this.modifyCSP(originalCSP, rule.actionValue);
          responseHeaders[cspHeaderIndex].value = modifiedCSP;
          modified = true;
          this.logger.debug("modified csp header", { url: details.url, rule: rule.name });
        } else {
          responseHeaders.push({
            name: "Content-Security-Policy",
            value: rule.actionValue,
          });
          modified = true;
          this.logger.debug("added csp header", { url: details.url, rule: rule.name });
        }
      }
    }

    if (modified) {
      return { responseHeaders };
    }
    return undefined;
  }

  private matchRule(rule: CSPRule, url: string, hostname: string): boolean {
    if (!rule.enabled) {
      return false;
    }

    const pattern = rule.path;

    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      try {
        const regex = new RegExp(pattern.slice(1, -1), "i");
        return regex.test(url);
      } catch (e) {
        this.logger.error("invalid regex pattern", { pattern, error: String(e) });
        return false;
      }
    }

    if (pattern.startsWith("*://")) {
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
      try {
        const regex = new RegExp(`^${regexPattern}$`, "i");
        return regex.test(url);
      } catch (e) {
        this.logger.error("invalid wildcard pattern", { pattern, error: String(e) });
        return false;
      }
    }

    if (pattern.includes("*")) {
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
      try {
        const regex = new RegExp(regexPattern, "i");
        return regex.test(hostname) || regex.test(url);
      } catch (e) {
        this.logger.error("invalid pattern", { pattern, error: String(e) });
        return false;
      }
    }

    return hostname === pattern || url.includes(pattern);
  }

  private modifyCSP(originalCSP: string, additionalDirectives: string): string {
    const directives = additionalDirectives.split(";").map((d) => d.trim()).filter((d) => d);

    let csp = originalCSP;

    for (const directive of directives) {
      const [directiveName, ...directiveValues] = directive.split(/\s+/);
      const directiveNameLower = directiveName.toLowerCase();

      const existingDirectiveRegex = new RegExp(`(${directiveNameLower}\\s+[^;]*)`, "i");
      const match = csp.match(existingDirectiveRegex);

      if (match) {
        for (const value of directiveValues) {
          if (!match[1].includes(value)) {
            csp = csp.replace(existingDirectiveRegex, `$1 ${value}`);
          }
        }
      } else {
        csp += `; ${directive}`;
      }
    }

    return csp;
  }
}
