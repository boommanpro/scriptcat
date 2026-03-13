import type { BrowsingRuleDAO, BrowsingRule, BrowsingRuleAction } from "@App/app/repo/browsingStats";

export interface RuleMatchResult {
    exclude: boolean;
    actions: BrowsingRuleAction[];
    metadata?: Record<string, any>;
}

export class RuleEngine {
    private rules: BrowsingRule[] = [];
    private loaded: boolean = false;

    async loadRules(ruleDAO: BrowsingRuleDAO): Promise<void> {
        this.rules = await ruleDAO.findByPriority();
        this.loaded = true;
    }

    matchRules(url: string): RuleMatchResult {
        const result: RuleMatchResult = {
            exclude: false,
            actions: [],
        };

        if (!this.loaded || this.rules.length === 0) {
            return result;
        }

        for (const rule of this.rules) {
            if (!rule.enabled) continue;

            if (this.matchPattern(url, rule.patterns)) {
                for (const action of rule.actions) {
                    if (action.type === "exclude") {
                        result.exclude = true;
                    }
                    result.actions.push(action);
                }

                if (result.exclude) {
                    break;
                }
            }
        }

        return result;
    }

    private matchPattern(url: string, patterns: string[]): boolean {
        for (const pattern of patterns) {
            if (this.isMatch(url, pattern)) {
                return true;
            }
        }
        return false;
    }

    private isMatch(url: string, pattern: string): boolean {
        if (pattern.startsWith("/") && pattern.endsWith("/")) {
            try {
                const regex = new RegExp(pattern.slice(1, -1));
                return regex.test(url);
            } catch {
                return false;
            }
        }

        if (pattern.includes("*")) {
            const regexPattern = this.globToRegex(pattern);
            try {
                const regex = new RegExp(regexPattern);
                return regex.test(url);
            } catch {
                return false;
            }
        }

        return url.includes(pattern);
    }

    private globToRegex(glob: string): string {
        return glob
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");
    }

    addRule(rule: BrowsingRule): void {
        const insertIndex = this.rules.findIndex((r) => r.priority < rule.priority);
        if (insertIndex === -1) {
            this.rules.push(rule);
        } else {
            this.rules.splice(insertIndex, 0, rule);
        }
    }

    removeRule(ruleId: string): void {
        this.rules = this.rules.filter((r) => r.id !== ruleId);
    }

    updateRule(rule: BrowsingRule): void {
        const index = this.rules.findIndex((r) => r.id === rule.id);
        if (index !== -1) {
            this.rules[index] = rule;
            this.rules.sort((a, b) => b.priority - a.priority);
        }
    }

    getRules(): BrowsingRule[] {
        return [...this.rules];
    }

    clearRules(): void {
        this.rules = [];
    }
}
