import type { IMessageQueue } from "@Packages/message/message_queue";
import { CSPRuleDAO, type CSPRule } from "@App/app/repo/cspRule";
import type Logger from "@App/app/logger/logger";
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

  private handleHeadersReceived(
    details: chrome.webRequest.OnHeadersReceivedDetails
  ): chrome.webRequest.BlockingResponse | undefined {
    if (!this.enabledRules.length) {
      return undefined;
    }

    const url = new URL(details.url);
    const matchingRules = this.enabledRules.filter((rule) => this.matchRule(rule, url.href, url.hostname));

    if (!matchingRules.length) {
      return undefined;
    }

    // Sort by priority (higher priority first)
    matchingRules.sort((a, b) => b.priority - a.priority);

    const responseHeaders = details.responseHeaders ? [...details.responseHeaders] : [];
    let modified = false;

    this.logger.info("csp rule matched", {
      url: details.url,
      hostname: url.hostname,
      matchedRules: matchingRules.map((r) => ({ name: r.name, action: r.action, priority: r.priority })),
    });

    for (const rule of matchingRules) {
      const cspHeaderIndex = responseHeaders.findIndex((h) => h.name.toLowerCase() === "content-security-policy");

      if (rule.action === "remove") {
        if (cspHeaderIndex !== -1) {
          const removed = responseHeaders.splice(cspHeaderIndex, 1);
          modified = true;
          this.logger.info("removed csp header", { 
            url: details.url, 
            rule: rule.name,
            removedHeader: removed[0]
          });
        } else {
          this.logger.debug("csp header not found, nothing to remove", { url: details.url, rule: rule.name });
        }
      } else if (rule.action === "modify" && rule.actionValue) {
        if (cspHeaderIndex !== -1) {
          const originalCSP = responseHeaders[cspHeaderIndex].value || "";
          const modifiedCSP = this.modifyCSP(originalCSP, rule.actionValue);
          responseHeaders[cspHeaderIndex].value = modifiedCSP;
          modified = true;
          this.logger.info("modified csp header", { 
            url: details.url, 
            rule: rule.name,
            originalCSP,
            modifiedCSP 
          });
        } else {
          responseHeaders.push({
            name: "Content-Security-Policy",
            value: rule.actionValue,
          });
          modified = true;
          this.logger.info("added csp header", { url: details.url, rule: rule.name, cspValue: rule.actionValue });
        }
      }
    }

    if (modified) {
      this.logger.info("response headers modified", { 
        url: details.url,
        finalHeaders: responseHeaders.filter(h => h.name.toLowerCase().includes('security'))
      });
      return { responseHeaders };
    }
    return undefined;
  }

  private matchRule(rule: CSPRule, url: string, hostname: string): boolean {
    if (!rule.enabled) {
      return false;
    }

    const pattern = rule.path;

    // Regex pattern (wrapped in /)
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      try {
        const regex = new RegExp(pattern.slice(1, -1), "i");
        const matches = regex.test(url);
        this.logger.debug("regex pattern match", { pattern, url, matches });
        return matches;
      } catch (e) {
        this.logger.error("invalid regex pattern", { pattern, error: String(e) });
        return false;
      }
    }

    // Wildcard pattern starting with *://
    if (pattern.startsWith("*://")) {
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
      try {
        const regex = new RegExp(`^${regexPattern}$`, "i");
        const matches = regex.test(url);
        this.logger.debug("wildcard *:// pattern match", { pattern, url, matches });
        return matches;
      } catch (e) {
        this.logger.error("invalid wildcard pattern", { pattern, error: String(e) });
        return false;
      }
    }

    // General wildcard pattern
    if (pattern.includes("*")) {
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
      try {
        const regex = new RegExp(`^${regexPattern}$`, "i");
        const matches = regex.test(url) || regex.test(hostname);
        this.logger.debug("general wildcard pattern match", { pattern, url, hostname, matches });
        return matches;
      } catch (e) {
        this.logger.error("invalid pattern", { pattern, error: String(e) });
        return false;
      }
    }

    // Exact match or substring match
    const exactMatch = hostname === pattern || url === pattern;
    const substringMatch = url.includes(pattern);
    this.logger.debug("exact/substring pattern match", { pattern, url, hostname, exactMatch, substringMatch });
    return exactMatch || substringMatch;
  }

  private modifyCSP(originalCSP: string, additionalDirectives: string): string {
    const directives = additionalDirectives
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d);

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
