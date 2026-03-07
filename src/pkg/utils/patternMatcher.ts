export type MatchResult = {
  matched: boolean;
  pattern: string;
  url: string;
  matchType: "exact" | "wildcard" | "regex" | "domain";
  details: string[];
  capturedGroups?: string[];
};

export type PatternType = "exact" | "wildcard" | "regex" | "domain";

export class PatternMatcher {
  static parsePatternType(pattern: string): PatternType {
    if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
      const lastSlash = pattern.lastIndexOf("/");
      if (lastSlash > 0) {
        return "regex";
      }
    }
    if (pattern.includes("*")) {
      return "wildcard";
    }
    if (pattern.includes("://")) {
      const urlPart = pattern.split("://")[1];
      if (urlPart && !urlPart.includes("/")) {
        return "domain";
      }
    }
    if (!pattern.includes("/")) {
      return "domain";
    }
    return "exact";
  }

  static match(pattern: string, url: string): MatchResult {
    const patternType = this.parsePatternType(pattern);
    const details: string[] = [];
    let matched = false;
    let capturedGroups: string[] = [];

    details.push(`Pattern type: ${patternType}`);
    details.push(`Input pattern: ${pattern}`);
    details.push(`Target URL: ${url}`);

    switch (patternType) {
      case "regex":
        const regexResult = this.matchRegex(pattern, url);
        matched = regexResult.matched;
        details.push(...regexResult.details);
        capturedGroups = regexResult.capturedGroups || [];
        break;
      case "wildcard":
        const wildcardResult = this.matchWildcard(pattern, url);
        matched = wildcardResult.matched;
        details.push(...wildcardResult.details);
        break;
      case "domain":
        const domainResult = this.matchDomain(pattern, url);
        matched = domainResult.matched;
        details.push(...domainResult.details);
        break;
      case "exact":
        const exactResult = this.matchExact(pattern, url);
        matched = exactResult.matched;
        details.push(...exactResult.details);
        break;
    }

    return {
      matched,
      pattern,
      url,
      matchType: patternType,
      details,
      capturedGroups,
    };
  }

  private static matchRegex(
    pattern: string,
    url: string
  ): { matched: boolean; details: string[]; capturedGroups?: string[] } {
    const details: string[] = [];
    const lastSlash = pattern.lastIndexOf("/");
    const regexBody = pattern.slice(1, lastSlash);
    const flags = pattern.slice(lastSlash + 1);

    details.push(`Regex body: ${regexBody}`);
    details.push(`Regex flags: ${flags || "none"}`);

    try {
      const regex = new RegExp(regexBody, flags || "i");
      const match = regex.exec(url);
      const matched = match !== null;

      if (matched) {
        details.push(`Match found at position: ${match.index}`);
        if (match.length > 1) {
          details.push(`Captured groups: ${JSON.stringify(match.slice(1))}`);
          return { matched, details, capturedGroups: match.slice(1) };
        }
      } else {
        details.push("No match found");
      }

      return { matched, details };
    } catch (e) {
      details.push(`Invalid regex: ${e}`);
      return { matched: false, details };
    }
  }

  private static matchWildcard(pattern: string, url: string): { matched: boolean; details: string[] } {
    const details: string[] = [];
    let normalizedPattern = pattern;

    if (pattern === "*" || pattern === "*://*" || pattern === "*://*/*") {
      details.push(`Global wildcard pattern detected`);
      return { matched: true, details };
    }

    if (!normalizedPattern.includes("://")) {
      if (normalizedPattern.startsWith("**.")) {
        normalizedPattern = `*://${normalizedPattern}`;
      } else if (normalizedPattern.startsWith("*.")) {
        normalizedPattern = `*://${normalizedPattern}`;
      } else if (normalizedPattern.startsWith("**")) {
        normalizedPattern = `*://${normalizedPattern}`;
      } else if (normalizedPattern.startsWith("*") && normalizedPattern.length > 1) {
        normalizedPattern = `*://${normalizedPattern.slice(1)}`;
      } else {
        normalizedPattern = `*://${normalizedPattern}`;
      }
      details.push(`Auto-added protocol: ${normalizedPattern}`);
    }

    const protocolEnd = normalizedPattern.indexOf("://");
    const afterProtocol = protocolEnd > -1 ? normalizedPattern.slice(protocolEnd + 3) : normalizedPattern;

    if (!afterProtocol.includes("/")) {
      if (normalizedPattern.endsWith("**")) {
        normalizedPattern = normalizedPattern + "/*";
      } else if (!normalizedPattern.endsWith("*")) {
        normalizedPattern = normalizedPattern + "/*";
      }
      details.push(`Auto-added path wildcard: ${normalizedPattern}`);
    }

    const regexPattern = this.wildcardToRegex(normalizedPattern);
    details.push(`Converted to regex: ${regexPattern}`);

    try {
      const regex = new RegExp(regexPattern, "i");
      const matched = regex.test(url);
      details.push(`Regex test result: ${matched}`);
      return { matched, details };
    } catch (e) {
      details.push(`Regex conversion error: ${e}`);
      return { matched: false, details };
    }
  }

  private static wildcardToRegex(pattern: string): string {
    let regex = "";
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];

      if (char === "*") {
        const nextChar = i + 1 < pattern.length ? pattern[i + 1] : "";
        const prevChar = i > 0 ? pattern[i - 1] : "";
        const nextNextChar = i + 2 < pattern.length ? pattern[i + 2] : "";

        if (nextChar === "*") {
          if (nextNextChar === ".") {
            regex += "(?:[^/]+\\.)?";
            i += 3;
            continue;
          } else if (prevChar === ".") {
            const afterDoubleStar = i + 2 < pattern.length ? pattern.slice(i + 2) : "";
            if (afterDoubleStar.startsWith("/") || afterDoubleStar === "") {
              regex += "[^/]+";
              i += 2;
              continue;
            }
            regex += "(?:[^/]+\\.)?";
            i += 2;
            continue;
          } else if (i === 0 || prevChar === "/") {
            regex += ".*";
            i += 2;
            continue;
          }
        }

        if (i === 0) {
          regex += "[^/:]+";
        } else if (prevChar === ":") {
          regex += "[^/:]+";
        } else if (prevChar === "/") {
          regex += ".*";
        } else if (prevChar === ".") {
          regex += "[^/]+";
        } else {
          regex += ".*";
        }
      } else if (".^$+?{}[]|()".includes(char)) {
        regex += `\\${char}`;
      } else {
        regex += char;
      }
      i++;
    }

    return `^${regex}$`;
  }

  private static matchDomain(pattern: string, url: string): { matched: boolean; details: string[] } {
    const details: string[] = [];
    let normalizedPattern = pattern;

    if (!normalizedPattern.includes("://")) {
      normalizedPattern = `*://${normalizedPattern}`;
      details.push(`Auto-added protocol: ${normalizedPattern}`);
    }

    normalizedPattern = normalizedPattern.replace(/\/?$/, "/*");
    details.push(`Auto-added path wildcard: ${normalizedPattern}`);

    return this.matchWildcard(normalizedPattern, url);
  }

  private static matchExact(pattern: string, url: string): { matched: boolean; details: string[] } {
    const details: string[] = [];
    let normalizedPattern = pattern;

    if (!normalizedPattern.includes("://")) {
      normalizedPattern = `*://${normalizedPattern}`;
      details.push(`Auto-added protocol: ${normalizedPattern}`);
    }

    if (normalizedPattern.endsWith("/")) {
      const urlObj = new URL(url);
      const matched =
        urlObj.origin + urlObj.pathname === normalizedPattern.slice(0, -1) ||
        url.startsWith(normalizedPattern) ||
        url === normalizedPattern.slice(0, -1);
      details.push(`Comparing: ${url} with ${normalizedPattern}`);
      return { matched, details };
    }

    const matched = url === normalizedPattern || url.startsWith(normalizedPattern + "/");
    details.push(`Comparing: ${url} with ${normalizedPattern}`);
    return { matched, details };
  }

  static toDeclarativeNetRequestFilter(pattern: string): {
    urlFilter?: string;
    regexFilter?: string;
  } | null {
    const patternType = this.parsePatternType(pattern);

    if (patternType === "regex") {
      const lastSlash = pattern.lastIndexOf("/");
      const regexBody = pattern.slice(1, lastSlash);
      try {
        new RegExp(regexBody);
        return { regexFilter: regexBody };
      } catch {
        return null;
      }
    }

    if (pattern === "*" || pattern === "*://*" || pattern === "*://*/*") {
      return { urlFilter: "*" };
    }

    let urlFilter = pattern;

    if (!urlFilter.includes("://")) {
      if (urlFilter.startsWith("*.")) {
        urlFilter = `*://${urlFilter}`;
      } else if (urlFilter.startsWith("*") && urlFilter.length > 1) {
        urlFilter = `*://${urlFilter.slice(1)}`;
      } else {
        urlFilter = `*://${urlFilter}`;
      }
    }

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

    return { urlFilter };
  }

  static validatePattern(pattern: string): { valid: boolean; error?: string; type?: PatternType } {
    if (!pattern || pattern.trim() === "") {
      return { valid: false, error: "Pattern cannot be empty" };
    }

    const patternType = this.parsePatternType(pattern);

    if (patternType === "regex") {
      const lastSlash = pattern.lastIndexOf("/");
      const regexBody = pattern.slice(1, lastSlash);
      try {
        new RegExp(regexBody);
        return { valid: true, type: patternType };
      } catch (e) {
        return { valid: false, error: `Invalid regex: ${e}` };
      }
    }

    if (pattern.includes("://")) {
      try {
        const parts = pattern.split("://");
        if (parts.length !== 2) {
          return { valid: false, error: "Invalid URL format" };
        }
      } catch (e) {
        return { valid: false, error: `Invalid pattern: ${e}` };
      }
    }

    return { valid: true, type: patternType };
  }

  static getPatternExamples(): { type: PatternType; patterns: string[]; descriptions: string[] }[] {
    return [
      {
        type: "exact",
        patterns: ["https://example.com/path", "https://example.com:8080/path"],
        descriptions: ["Exact URL match", "Exact URL with port"],
      },
      {
        type: "wildcard",
        patterns: [
          "*://example.com/*",
          "https://*.example.com/*",
          "*://*.example.com/*",
          "*://example.com:8080/*",
          "*://example.com/path/*",
        ],
        descriptions: [
          "Match any protocol, any path",
          "HTTPS only, any subdomain",
          "Any protocol, any subdomain",
          "Any protocol with specific port",
          "Any protocol, specific path prefix",
        ],
      },
      {
        type: "regex",
        patterns: ["/https?:\\/\\/example\\.com\\/.*/i", "/^https:\\/\\/([a-z]+\\.)?example\\.com/i"],
        descriptions: ["Match HTTP or HTTPS on example.com", "Match subdomains with regex"],
      },
      {
        type: "domain",
        patterns: ["example.com", "*.example.com", "example.com:8080"],
        descriptions: ["Match domain (any protocol)", "Match domain and subdomains", "Match domain with port"],
      },
    ];
  }
}
