import { describe, it, expect } from "vitest";
import { PatternMatcher } from "./patternMatcher";

describe("PatternMatcher", () => {
  describe("parsePatternType", () => {
    it("should identify regex patterns", () => {
      expect(PatternMatcher.parsePatternType("/https?:\\/\\/example\\.com/i")).toBe("regex");
      expect(PatternMatcher.parsePatternType("/.*/")).toBe("regex");
    });

    it("should identify wildcard patterns", () => {
      expect(PatternMatcher.parsePatternType("*://example.com/*")).toBe("wildcard");
      expect(PatternMatcher.parsePatternType("https://*.example.com/*")).toBe("wildcard");
      expect(PatternMatcher.parsePatternType("example.com/*")).toBe("wildcard");
    });

    it("should identify domain patterns", () => {
      expect(PatternMatcher.parsePatternType("example.com")).toBe("domain");
      expect(PatternMatcher.parsePatternType("*.example.com")).toBe("wildcard");
      expect(PatternMatcher.parsePatternType("example.com:8080")).toBe("domain");
    });

    it("should identify exact patterns", () => {
      expect(PatternMatcher.parsePatternType("https://example.com/path")).toBe("exact");
      expect(PatternMatcher.parsePatternType("https://example.com:8080/path")).toBe("exact");
    });
  });

  describe("match - wildcard patterns", () => {
    it("should match *://example.com/*", () => {
      const pattern = "*://example.com/*";

      expect(PatternMatcher.match(pattern, "https://example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "http://example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://example.com/path/to/page").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://sub.example.com/path").matched).toBe(false);
      expect(PatternMatcher.match(pattern, "https://other.com/path").matched).toBe(false);
    });

    it("should match https://*.example.com/*", () => {
      const pattern = "https://*.example.com/*";

      expect(PatternMatcher.match(pattern, "https://www.example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://api.example.com/test").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://sub.example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://example.com/path").matched).toBe(false);
      expect(PatternMatcher.match(pattern, "http://www.example.com/path").matched).toBe(false);
    });

    it("should match *://*.example.com/*", () => {
      const pattern = "*://*.example.com/*";

      expect(PatternMatcher.match(pattern, "https://www.example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "http://api.example.com/test").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://example.com/path").matched).toBe(false);
      expect(PatternMatcher.match(pattern, "https://other.com/path").matched).toBe(false);
    });

    it("should match domain-only patterns", () => {
      const pattern = "example.com";

      expect(PatternMatcher.match(pattern, "https://example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "http://example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://sub.example.com/path").matched).toBe(false);
    });

    it("should match subdomain patterns", () => {
      const pattern = "*.example.com";

      expect(PatternMatcher.match(pattern, "https://www.example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://api.example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://example.com/").matched).toBe(false);
      expect(PatternMatcher.match(pattern, "https://other.com/").matched).toBe(false);
    });

    it("should match **.example.com for domain and all subdomains", () => {
      const pattern = "**.example.com";

      expect(PatternMatcher.match(pattern, "https://example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://www.example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://api.example.com/test").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://deep.sub.example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://other.com/").matched).toBe(false);
    });

    it("should match *://**.example.com/* for domain and all subdomains", () => {
      const pattern = "*://**.example.com/*";

      expect(PatternMatcher.match(pattern, "https://example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "http://www.example.com/test").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://api.example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://other.com/").matched).toBe(false);
    });

    it("should match all URLs with *", () => {
      const pattern = "*";

      expect(PatternMatcher.match(pattern, "https://example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "http://other.com/path").matched).toBe(true);
    });
  });

  describe("match - regex patterns", () => {
    it("should match regex patterns correctly", () => {
      const pattern = "/https?:\\/\\/example\\.com\\/.*/i";

      expect(PatternMatcher.match(pattern, "https://example.com/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "http://example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "HTTPS://EXAMPLE.COM/PATH").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://sub.example.com/path").matched).toBe(false);
    });

    it("should capture groups correctly", () => {
      const pattern = "/^https:\\/\\/([a-z]+)\\.example\\.com/i";
      const result = PatternMatcher.match(pattern, "https://www.example.com");

      expect(result.matched).toBe(true);
      expect(result.capturedGroups).toEqual(["www"]);
    });

    it("should handle invalid regex gracefully", () => {
      const pattern = "/[invalid(/";
      const result = PatternMatcher.match(pattern, "https://example.com");

      expect(result.matched).toBe(false);
    });
  });

  describe("match - exact patterns", () => {
    it("should match exact URLs", () => {
      const pattern = "https://example.com/path";

      expect(PatternMatcher.match(pattern, "https://example.com/path").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://example.com/path/").matched).toBe(true);
      expect(PatternMatcher.match(pattern, "https://example.com/other").matched).toBe(false);
    });
  });

  describe("validatePattern", () => {
    it("should validate correct patterns", () => {
      expect(PatternMatcher.validatePattern("*://example.com/*").valid).toBe(true);
      expect(PatternMatcher.validatePattern("/https?:\\/\\/example\\.com/i").valid).toBe(true);
      expect(PatternMatcher.validatePattern("example.com").valid).toBe(true);
    });

    it("should reject empty patterns", () => {
      expect(PatternMatcher.validatePattern("").valid).toBe(false);
      expect(PatternMatcher.validatePattern("  ").valid).toBe(false);
    });

    it("should reject invalid regex", () => {
      expect(PatternMatcher.validatePattern("/[invalid(/").valid).toBe(false);
    });
  });

  describe("toDeclarativeNetRequestFilter", () => {
    it("should convert wildcard patterns to urlFilter", () => {
      const result = PatternMatcher.toDeclarativeNetRequestFilter("*://example.com/*");
      expect(result).not.toBeNull();
      expect(result?.urlFilter).toBeDefined();
      expect(result?.regexFilter).toBeUndefined();
    });

    it("should convert regex patterns to regexFilter", () => {
      const result = PatternMatcher.toDeclarativeNetRequestFilter("/https?:\\/\\/example\\.com/i");
      expect(result).not.toBeNull();
      expect(result?.regexFilter).toBe("https?:\\/\\/example\\.com");
      expect(result?.urlFilter).toBeUndefined();
    });

    it("should handle global wildcard", () => {
      const result = PatternMatcher.toDeclarativeNetRequestFilter("*");
      expect(result).toEqual({ urlFilter: "*" });
    });

    it("should auto-add protocol and path for domain patterns", () => {
      const result = PatternMatcher.toDeclarativeNetRequestFilter("example.com");
      expect(result).not.toBeNull();
      expect(result?.urlFilter).toContain("://");
      expect(result?.urlFilter).toContain("*");
    });
  });

  describe("edge cases", () => {
    it("should handle URLs with query strings", () => {
      const pattern = "*://example.com/*";
      expect(PatternMatcher.match(pattern, "https://example.com/path?query=value").matched).toBe(true);
    });

    it("should handle URLs with fragments", () => {
      const pattern = "*://example.com/*";
      expect(PatternMatcher.match(pattern, "https://example.com/path#fragment").matched).toBe(true);
    });

    it("should handle URLs with ports", () => {
      const pattern = "*://example.com:8080/*";
      expect(PatternMatcher.match(pattern, "https://example.com:8080/path").matched).toBe(true);
    });

    it("should handle special characters in domain", () => {
      const pattern = "*://example-test.com/*";
      expect(PatternMatcher.match(pattern, "https://example-test.com/path").matched).toBe(true);
    });
  });
});
