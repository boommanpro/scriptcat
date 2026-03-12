import { Repo } from "./repo";

export interface PageVisitRecord {
  id: string;
  url: string;
  title: string;
  domain: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  isActive: boolean;
  tabId: number;
  windowId: number;
  referrer: string | null;
  metadata?: Record<string, any>;
}

export interface DomainStats {
  domain: string;
  visitCount: number;
  totalDuration: number;
}

export interface PageStats {
  url: string;
  title: string;
  visitCount: number;
  totalDuration: number;
}

export interface TimelineEntry {
  id: string;
  url: string;
  title: string;
  domain: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  referrer: string | null;
}

export interface DailyStats {
  date: string;
  totalVisits: number;
  totalDuration: number;
  uniqueDomains: number;
  uniquePages: number;
  topDomains: DomainStats[];
  topPages: PageStats[];
  hourlyDistribution: number[];
  timeline: TimelineEntry[];
  lastUpdated: number;
}

export interface PageTransition {
  id: string;
  fromUrl: string | null;
  toUrl: string;
  fromDomain: string | null;
  toDomain: string;
  timestamp: number;
  transitionType: string;
  tabId: number;
}

export interface BrowsingRuleAction {
  type: "exclude" | "custom_metadata" | "track_operations";
  config?: Record<string, any>;
}

export interface BrowsingRule {
  id: string;
  name: string;
  enabled: boolean;
  patterns: string[];
  actions: BrowsingRuleAction[];
  priority: number;
  createdAt: number;
  updatedAt: number;
}

export interface BrowsingStatsConfig {
  enabled: boolean;
  trackIncognito: boolean;
  excludedDomains: string[];
  excludedPatterns: string[];
  retentionDays: number;
  syncEnabled: boolean;
  lastSyncTime: number | null;
}

export class PageVisitDAO extends Repo<PageVisitRecord> {
  constructor() {
    super("pageVisit");
  }

  public save(record: PageVisitRecord): Promise<PageVisitRecord> {
    return super._save(record.id, record);
  }

  async findByDate(date: string): Promise<PageVisitRecord[]> {
    const startOfDay = new Date(date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(date).setHours(23, 59, 59, 999);

    return this.find((_, value) => {
      return value.startTime >= startOfDay && value.startTime <= endOfDay;
    });
  }

  async findByDateRange(startDate: string, endDate: string): Promise<PageVisitRecord[]> {
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);

    return this.find((_, value) => {
      return value.startTime >= start && value.startTime <= end;
    });
  }

  async findActiveRecords(): Promise<PageVisitRecord[]> {
    return this.find((_, value) => {
      return value.isActive === true;
    });
  }

  async deleteByDate(date: string): Promise<void> {
    const records = await this.findByDate(date);
    const keys = records.map((r) => r.id);
    if (keys.length > 0) {
      await this.deletes(keys);
    }
  }

  async deleteBeforeDate(date: string): Promise<void> {
    const timestamp = new Date(date).setHours(0, 0, 0, 0);
    const records = await this.find((_, value) => {
      return value.startTime < timestamp;
    });
    const keys = records.map((r) => r.id);
    if (keys.length > 0) {
      await this.deletes(keys);
    }
  }
}

export class DailyStatsDAO extends Repo<DailyStats> {
  constructor() {
    super("dailyStats");
  }

  public save(stats: DailyStats): Promise<DailyStats> {
    return super._save(stats.date, stats);
  }

  async findByDate(date: string): Promise<DailyStats | undefined> {
    return this.get(date);
  }

  async findByDateRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    return this.find((key, _) => {
      const date = key.replace(this.prefix, "");
      return date >= startDate && date <= endDate;
    });
  }

  async deleteBeforeDate(date: string): Promise<void> {
    const stats = await this.find((key, _) => {
      const statsDate = key.replace(this.prefix, "");
      return statsDate < date;
    });
    const keys = stats.map((s) => s.date);
    if (keys.length > 0) {
      await this.deletes(keys);
    }
  }
}

export class PageTransitionDAO extends Repo<PageTransition> {
  constructor() {
    super("pageTransition");
  }

  public save(transition: PageTransition): Promise<PageTransition> {
    return super._save(transition.id, transition);
  }

  async findByDate(date: string): Promise<PageTransition[]> {
    const startOfDay = new Date(date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(date).setHours(23, 59, 59, 999);

    return this.find((_, value) => {
      return value.timestamp >= startOfDay && value.timestamp <= endOfDay;
    });
  }

  async deleteBeforeDate(date: string): Promise<void> {
    const timestamp = new Date(date).setHours(0, 0, 0, 0);
    const transitions = await this.find((_, value) => {
      return value.timestamp < timestamp;
    });
    const keys = transitions.map((t) => t.id);
    if (keys.length > 0) {
      await this.deletes(keys);
    }
  }
}

export class BrowsingRuleDAO extends Repo<BrowsingRule> {
  constructor() {
    super("browsingRule");
  }

  public save(rule: BrowsingRule): Promise<BrowsingRule> {
    return super._save(rule.id, rule);
  }

  async findEnabled(): Promise<BrowsingRule[]> {
    return this.find((_, value) => {
      return value.enabled === true;
    });
  }

  async findByPriority(): Promise<BrowsingRule[]> {
    const rules = await this.all();
    return rules.sort((a, b) => b.priority - a.priority);
  }
}

export class BrowsingStatsConfigDAO extends Repo<BrowsingStatsConfig> {
  private static CONFIG_KEY = "config";

  constructor() {
    super("browsingStatsConfig");
  }

  async getConfig(): Promise<BrowsingStatsConfig> {
    const config = await this.get(BrowsingStatsConfigDAO.CONFIG_KEY);
    if (!config) {
      return this.getDefaultConfig();
    }
    return config;
  }

  async saveConfig(config: BrowsingStatsConfig): Promise<BrowsingStatsConfig> {
    return super._save(BrowsingStatsConfigDAO.CONFIG_KEY, config);
  }

  getDefaultConfig(): BrowsingStatsConfig {
    return {
      enabled: false,
      trackIncognito: false,
      excludedDomains: [],
      excludedPatterns: [],
      retentionDays: 30,
      syncEnabled: false,
      lastSyncTime: null,
    };
  }
}

export function formatDateForStats(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return "";
  }
}

export function generateVisitId(tabId: number, timestamp: number): string {
  return `${tabId}-${timestamp}`;
}

export function generateTransitionId(tabId: number, timestamp: number): string {
  return `trans-${tabId}-${timestamp}`;
}

export function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
