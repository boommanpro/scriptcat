import type { IMessageQueue } from "@Packages/message/message_queue";
import type { Group } from "@Packages/message/server";
import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import {
    PageVisitDAO,
    DailyStatsDAO,
    PageTransitionDAO,
    BrowsingRuleDAO,
    BrowsingStatsConfigDAO,
    type PageVisitRecord,
    type DailyStats,
    type PageTransition,
    type BrowsingStatsConfig,
    type TimelineEntry,
    type DomainStats,
    type PageStats,
    formatDateForStats,
    extractDomain,
    generateVisitId,
    generateTransitionId,
} from "@App/app/repo/browsingStats";
import { RuleEngine, type RuleMatchResult } from "./ruleEngine";

export interface TabVisitState {
    tabId: number;
    windowId: number;
    url: string;
    title: string;
    startTime: number;
    visitId: string;
    isActive: boolean;
    lastActiveTime: number;
    referrer: string | null;
    duration: number;
}

export interface PageVisitStartData {
    url: string;
    title: string;
    tabId: number;
    windowId: number;
    referrer: string | null;
    transitionType?: string;
}

export interface PageVisitEndData {
    tabId: number;
    url: string;
}

export interface PageFocusData {
    tabId: number;
    windowId: number;
    url: string;
    title: string;
}

export interface PageBlurData {
    tabId: number;
}

const STATS_TOPIC = "browsingStats";

export class BrowsingStatsService {
    private logger: Logger;
    private pageVisitDAO: PageVisitDAO;
    private dailyStatsDAO: DailyStatsDAO;
    private pageTransitionDAO: PageTransitionDAO;
    private ruleDAO: BrowsingRuleDAO;
    private configDAO: BrowsingStatsConfigDAO;
    private ruleEngine: RuleEngine;

    private tabStates: Map<number, TabVisitState> = new Map();
    private activeTabId: number | null = null;
    private activeWindowId: number | null = null;
    private config: BrowsingStatsConfig | null = null;
    private configLoaded: boolean = false;
    private pendingUpdates: Map<string, Partial<PageVisitRecord>> = new Map();
    private updateTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly UPDATE_INTERVAL = 5000;

    constructor(
        private mq: IMessageQueue,
        private group: Group
    ) {
        this.logger = LoggerCore.logger({ component: "browsingStats" });
        this.pageVisitDAO = new PageVisitDAO();
        this.dailyStatsDAO = new DailyStatsDAO();
        this.pageTransitionDAO = new PageTransitionDAO();
        this.ruleDAO = new BrowsingRuleDAO();
        this.configDAO = new BrowsingStatsConfigDAO();
        this.ruleEngine = new RuleEngine();
    }

    async init(): Promise<void> {
        this.config = await this.configDAO.getConfig();
        this.configLoaded = true;

        await this.ruleEngine.loadRules(this.ruleDAO);

        this.setupMessageHandlers();
        this.setupChromeEventListeners();
        this.startPeriodicUpdate();
        this.scheduleCleanup();

        this.logger.info("BrowsingStatsService initialized");
    }

    private setupMessageHandlers(): void {
        this.group.on("visitStart", async (data: PageVisitStartData) => {
            if (!this.isTrackingEnabled()) return;
            await this.handleVisitStart(data);
        });

        this.group.on("visitEnd", async (data: PageVisitEndData) => {
            if (!this.isTrackingEnabled()) return;
            await this.handleVisitEnd(data);
        });

        this.group.on("pageFocus", async (data: PageFocusData) => {
            if (!this.isTrackingEnabled()) return;
            await this.handlePageFocus(data);
        });

        this.group.on("pageBlur", async (data: PageBlurData) => {
            if (!this.isTrackingEnabled()) return;
            await this.handlePageBlur(data);
        });

        this.group.on("getDailyStats", async (date: string) => {
            return this.getDailyStats(date);
        });

        this.group.on("getStatsRange", async (data: { startDate: string; endDate: string }) => {
            return this.getStatsRange(data.startDate, data.endDate);
        });

        this.group.on("getPageDetails", async (url: string) => {
            return this.getPageDetails(url);
        });

        this.group.on("getConfig", async () => {
            return this.getConfig();
        });

        this.group.on("updateConfig", async (config: Partial<BrowsingStatsConfig>) => {
            return this.updateConfig(config);
        });

        this.group.on("exportData", async (data: { startDate: string; endDate: string }) => {
            return this.exportData(data.startDate, data.endDate);
        });

        this.group.on("clearData", async (beforeDate?: string) => {
            return this.clearData(beforeDate);
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!message.action || !message.action.startsWith("browsingStats_")) {
                return false;
            }

            const action = message.action.replace("browsingStats_", "");
            this.logger.info("Received message", { action, sender: sender.tab?.id, url: sender.url });

            (async () => {
                try {
                    if (!this.configLoaded) {
                        this.config = await this.configDAO.getConfig();
                        this.configLoaded = true;
                    }

                    if (action === "visitStart" || action === "visitEnd" || action === "pageFocus" || action === "pageBlur") {
                        if (!this.isTrackingEnabled()) {
                            this.logger.info("Tracking disabled, ignoring message", { action });
                            return;
                        }

                        const tabId = sender.tab?.id;
                        const windowId = sender.tab?.windowId;

                        if (!tabId) {
                            this.logger.warn("No tabId in sender, ignoring message", { action });
                            return;
                        }

                        const data = {
                            ...message.data,
                            tabId,
                            windowId: windowId || 0,
                        };

                        this.logger.info("Processing content script message", { action, tabId, url: message.data?.url });

                        if (action === "visitStart") {
                            await this.handleVisitStart(data as PageVisitStartData);
                        } else if (action === "visitEnd") {
                            await this.handleVisitEnd(data as PageVisitEndData);
                        } else if (action === "pageFocus") {
                            await this.handlePageFocus(data as PageFocusData);
                        } else if (action === "pageBlur") {
                            await this.handlePageBlur(data as PageBlurData);
                        }
                        return;
                    }

                    let result: any;
                    switch (action) {
                        case "getConfig":
                            result = await this.getConfig();
                            break;
                        case "updateConfig":
                            result = await this.updateConfig(message.data);
                            break;
                        case "getDailyStats":
                            result = await this.getDailyStats(message.data.date);
                            break;
                        case "getStatsRange":
                            result = await this.getStatsRange(message.data.startDate, message.data.endDate);
                            break;
                        case "getPageDetails":
                            result = await this.getPageDetails(message.data.url);
                            break;
                        case "exportData":
                            result = await this.exportData(message.data.startDate, message.data.endDate);
                            break;
                        case "clearData":
                            result = await this.clearData(message.data?.beforeDate);
                            break;
                        default:
                            sendResponse({ error: "Unknown action" });
                            return;
                    }
                    sendResponse(result);
                } catch (error) {
                    this.logger.error("Message handler error", { action, error });
                    sendResponse({ error: String(error) });
                }
            })();

            return true;
        });
    }

    private setupChromeEventListeners(): void {
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabClosed(tabId);
        });

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.url) {
                this.handleTabUrlChanged(tabId, changeInfo.url, tab);
            }
            if (changeInfo.status === "complete" && tab.url) {
                this.handleTabComplete(tabId, tab);
            }
        });

        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivated(activeInfo.tabId, activeInfo.windowId);
        });

        chrome.windows.onFocusChanged.addListener((windowId) => {
            this.handleWindowFocusChanged(windowId);
        });
    }

    private isTrackingEnabled(): boolean {
        return this.config?.enabled ?? false;
    }

    private shouldTrackUrl(url: string): boolean {
        if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
            return false;
        }

        const domain = extractDomain(url);
        if (this.config?.excludedDomains?.includes(domain)) {
            return false;
        }

        const ruleResult = this.ruleEngine.matchRules(url);
        if (ruleResult.exclude) {
            return false;
        }

        return true;
    }

    private shouldTrackIncognito(tab: chrome.tabs.Tab): boolean {
        if (tab.incognito && !this.config?.trackIncognito) {
            return false;
        }
        return true;
    }

    async handleVisitStart(data: PageVisitStartData): Promise<void> {
        this.logger.info("handleVisitStart called", { url: data.url, tabId: data.tabId, windowId: data.windowId });

        if (!this.shouldTrackUrl(data.url)) {
            this.logger.info("URL not trackable, skipping", { url: data.url });
            return;
        }

        const existingState = this.tabStates.get(data.tabId);
        if (existingState && existingState.url !== data.url) {
            this.logger.info("Finalizing existing visit", { tabId: data.tabId, oldUrl: existingState.url });
            await this.finalizeVisit(existingState);
        }

        const now = Date.now();
        const visitId = generateVisitId(data.tabId, now);

        const state: TabVisitState = {
            tabId: data.tabId,
            windowId: data.windowId,
            url: data.url,
            title: data.title,
            startTime: now,
            visitId,
            isActive: this.activeTabId === data.tabId,
            lastActiveTime: now,
            referrer: data.referrer,
            duration: 0,
        };

        this.tabStates.set(data.tabId, state);
        this.logger.info("Visit state created", { visitId, url: data.url, tabId: data.tabId });

        if (data.referrer && this.shouldTrackUrl(data.referrer)) {
            await this.recordTransition({
                fromUrl: data.referrer,
                toUrl: data.url,
                tabId: data.tabId,
                transitionType: data.transitionType || "link",
            });
        }

        this.logger.info("Visit started successfully", { url: data.url, tabId: data.tabId });
    }

    async handleVisitEnd(data: PageVisitEndData): Promise<void> {
        const state = this.tabStates.get(data.tabId);
        if (state && state.url === data.url) {
            await this.finalizeVisit(state);
            this.tabStates.delete(data.tabId);
        }
    }

    async handlePageFocus(data: PageFocusData): Promise<void> {
        if (!this.shouldTrackUrl(data.url)) {
            return;
        }

        if (this.activeTabId !== null && this.activeTabId !== data.tabId) {
            const previousState = this.tabStates.get(this.activeTabId);
            if (previousState) {
                previousState.isActive = false;
                await this.updateVisitDuration(previousState);
            }
        }

        let state = this.tabStates.get(data.tabId);
        if (!state || state.url !== data.url) {
            await this.handleVisitStart({
                url: data.url,
                title: data.title,
                tabId: data.tabId,
                windowId: data.windowId,
                referrer: state?.url || null,
            });
            state = this.tabStates.get(data.tabId);
        }

        if (state) {
            state.isActive = true;
            state.lastActiveTime = Date.now();
            state.title = data.title;
        }

        this.activeTabId = data.tabId;
        this.activeWindowId = data.windowId;

        this.logger.debug("Page focused", { url: data.url, tabId: data.tabId });
    }

    async handlePageBlur(data: PageBlurData): Promise<void> {
        const state = this.tabStates.get(data.tabId);
        if (state && state.isActive) {
            state.isActive = false;
            await this.updateVisitDuration(state);
        }

        if (this.activeTabId === data.tabId) {
            this.activeTabId = null;
        }
    }

    private async handleTabClosed(tabId: number): Promise<void> {
        const state = this.tabStates.get(tabId);
        if (state) {
            await this.finalizeVisit(state);
            this.tabStates.delete(tabId);
        }

        if (this.activeTabId === tabId) {
            this.activeTabId = null;
        }
    }

    private async handleTabUrlChanged(tabId: number, newUrl: string, tab: chrome.tabs.Tab): Promise<void> {
        if (!this.shouldTrackIncognito(tab)) {
            return;
        }

        const state = this.tabStates.get(tabId);
        if (state && state.url !== newUrl) {
            await this.finalizeVisit(state);

            await this.handleVisitStart({
                url: newUrl,
                title: tab.title || "",
                tabId,
                windowId: tab.windowId,
                referrer: state.url,
                transitionType: "navigate",
            });
        }
    }

    private async handleTabComplete(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
        if (!tab.url || !this.shouldTrackIncognito(tab)) {
            return;
        }

        const state = this.tabStates.get(tabId);
        if (state && tab.title) {
            state.title = tab.title;
        }
    }

    private async handleTabActivated(tabId: number, windowId: number): Promise<void> {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab.url || !this.shouldTrackIncognito(tab)) {
                return;
            }

            await this.handlePageFocus({
                tabId,
                windowId,
                url: tab.url,
                title: tab.title || "",
            });
        } catch (error) {
            this.logger.debug("Tab activated but not accessible", { tabId, error });
        }
    }

    private async handleWindowFocusChanged(windowId: number): Promise<void> {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            if (this.activeTabId !== null) {
                const state = this.tabStates.get(this.activeTabId);
                if (state) {
                    state.isActive = false;
                    await this.updateVisitDuration(state);
                }
            }
            this.activeTabId = null;
            this.activeWindowId = null;
            return;
        }

        try {
            const [activeTab] = await chrome.tabs.query({ active: true, windowId });
            if (activeTab && activeTab.id && activeTab.url) {
                await this.handlePageFocus({
                    tabId: activeTab.id,
                    windowId,
                    url: activeTab.url,
                    title: activeTab.title || "",
                });
            }
        } catch (error) {
            this.logger.debug("Window focus changed but no active tab", { windowId, error });
        }
    }

    private async updateVisitDuration(state: TabVisitState): Promise<void> {
        const now = Date.now();
        if (state.isActive) {
            state.duration = (state.duration || 0) + (now - state.lastActiveTime);
            state.lastActiveTime = now;
        }
    }

    private async finalizeVisit(state: TabVisitState): Promise<void> {
        this.logger.info("finalizeVisit called", { url: state.url, tabId: state.tabId, visitId: state.visitId });
        await this.updateVisitDuration(state);

        const record: PageVisitRecord = {
            id: state.visitId,
            url: state.url,
            title: state.title,
            domain: extractDomain(state.url),
            startTime: state.startTime,
            endTime: Date.now(),
            duration: state.duration || 0,
            isActive: false,
            tabId: state.tabId,
            windowId: state.windowId,
            referrer: state.referrer,
        };

        this.logger.info("Saving visit record", { id: record.id, url: record.url, duration: record.duration });
        await this.pageVisitDAO.save(record);
        this.logger.info("Visit record saved successfully", { id: record.id });

        await this.updateDailyStats(formatDateForStats(state.startTime));

        this.logger.info("Visit finalized", {
            url: state.url,
            duration: record.duration,
        });
    }

    private async recordTransition(data: {
        fromUrl: string | null;
        toUrl: string;
        tabId: number;
        transitionType: string;
    }): Promise<void> {
        const transition: PageTransition = {
            id: generateTransitionId(data.tabId, Date.now()),
            fromUrl: data.fromUrl,
            toUrl: data.toUrl,
            fromDomain: data.fromUrl ? extractDomain(data.fromUrl) : null,
            toDomain: extractDomain(data.toUrl),
            timestamp: Date.now(),
            transitionType: data.transitionType,
            tabId: data.tabId,
        };

        await this.pageTransitionDAO.save(transition);
    }

    async getDailyStats(date: string): Promise<DailyStats | undefined> {
        let stats = await this.dailyStatsDAO.findByDate(date);
        if (!stats) {
            stats = await this.aggregateDailyStats(date);
        }
        return stats;
    }

    async getStatsRange(startDate: string, endDate: string): Promise<DailyStats[]> {
        return this.dailyStatsDAO.findByDateRange(startDate, endDate);
    }

    private async aggregateDailyStats(date: string): Promise<DailyStats> {
        const records = await this.pageVisitDAO.findByDate(date);
        const transitions = await this.pageTransitionDAO.findByDate(date);

        const domainMap = new Map<string, DomainStats>();
        const pageMap = new Map<string, PageStats>();
        const hourlyDistribution = new Array(24).fill(0);
        const uniqueUrls = new Set<string>();

        for (const record of records) {
            const domain = record.domain;
            const existingDomain = domainMap.get(domain) || {
                domain,
                visitCount: 0,
                totalDuration: 0,
            };
            existingDomain.visitCount++;
            existingDomain.totalDuration += record.duration;
            domainMap.set(domain, existingDomain);

            const existingPage = pageMap.get(record.url) || {
                url: record.url,
                title: record.title,
                visitCount: 0,
                totalDuration: 0,
            };
            existingPage.visitCount++;
            existingPage.totalDuration += record.duration;
            pageMap.set(record.url, existingPage);

            uniqueUrls.add(record.url);

            const hour = new Date(record.startTime).getHours();
            hourlyDistribution[hour]++;
        }

        const topDomains = Array.from(domainMap.values())
            .sort((a, b) => b.totalDuration - a.totalDuration)
            .slice(0, 10);

        const topPages = Array.from(pageMap.values())
            .sort((a, b) => b.totalDuration - a.totalDuration)
            .slice(0, 10);

        const timeline: TimelineEntry[] = records
            .sort((a, b) => a.startTime - b.startTime)
            .map((r) => ({
                id: r.id,
                url: r.url,
                title: r.title,
                domain: r.domain,
                startTime: r.startTime,
                endTime: r.endTime,
                duration: r.duration,
                referrer: r.referrer,
            }));

        const stats: DailyStats = {
            date,
            totalVisits: records.length,
            totalDuration: records.reduce((sum, r) => sum + r.duration, 0),
            uniqueDomains: domainMap.size,
            uniquePages: uniqueUrls.size,
            topDomains,
            topPages,
            hourlyDistribution,
            timeline,
            lastUpdated: Date.now(),
        };

        await this.dailyStatsDAO.save(stats);
        return stats;
    }

    private async updateDailyStats(date: string): Promise<void> {
        this.pendingUpdates.set(date, {});
        this.scheduleBatchUpdate();
    }

    private scheduleBatchUpdate(): void {
        if (this.updateTimer) {
            return;
        }

        this.updateTimer = setTimeout(async () => {
            this.updateTimer = null;
            const dates = Array.from(this.pendingUpdates.keys());
            this.pendingUpdates.clear();

            for (const date of dates) {
                try {
                    await this.aggregateDailyStats(date);
                } catch (error) {
                    this.logger.error("Failed to update daily stats", { date, error });
                }
            }
        }, this.UPDATE_INTERVAL);
    }

    async getPageDetails(url: string): Promise<{
        url: string;
        title: string;
        visitCount: number;
        totalDuration: number;
        firstVisit: number | null;
        lastVisit: number | null;
        referrers: { url: string; count: number }[];
        destinations: { url: string; count: number }[];
    }> {
        const records = await this.pageVisitDAO.find((_, value) => value.url === url);
        const transitions = await this.pageTransitionDAO.find(
            (_, value) => value.toUrl === url || value.fromUrl === url
        );

        const referrerMap = new Map<string, number>();
        const destinationMap = new Map<string, number>();

        for (const t of transitions) {
            if (t.toUrl === url && t.fromUrl) {
                referrerMap.set(t.fromUrl, (referrerMap.get(t.fromUrl) || 0) + 1);
            }
            if (t.fromUrl === url && t.toUrl) {
                destinationMap.set(t.toUrl, (destinationMap.get(t.toUrl) || 0) + 1);
            }
        }

        const sortedRecords = records.sort((a, b) => a.startTime - b.startTime);

        return {
            url,
            title: sortedRecords[0]?.title || "",
            visitCount: records.length,
            totalDuration: records.reduce((sum, r) => sum + r.duration, 0),
            firstVisit: sortedRecords[0]?.startTime || null,
            lastVisit: sortedRecords[sortedRecords.length - 1]?.startTime || null,
            referrers: Array.from(referrerMap.entries())
                .map(([url, count]) => ({ url, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            destinations: Array.from(destinationMap.entries())
                .map(([url, count]) => ({ url, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
        };
    }

    async getConfig(): Promise<BrowsingStatsConfig> {
        if (!this.configLoaded) {
            this.config = await this.configDAO.getConfig();
            this.configLoaded = true;
        }
        return this.config!;
    }

    async updateConfig(updates: Partial<BrowsingStatsConfig>): Promise<BrowsingStatsConfig> {
        const currentConfig = await this.getConfig();
        this.config = { ...currentConfig, ...updates };
        await this.configDAO.saveConfig(this.config);
        return this.config;
    }

    async exportData(startDate: string, endDate: string): Promise<{
        pageVisits: PageVisitRecord[];
        transitions: PageTransition[];
        dailyStats: DailyStats[];
    }> {
        const pageVisits = await this.pageVisitDAO.findByDateRange(startDate, endDate);
        const dailyStats = await this.dailyStatsDAO.findByDateRange(startDate, endDate);

        const start = new Date(startDate).setHours(0, 0, 0, 0);
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        const transitions = await this.pageTransitionDAO.find((_, value) => {
            return value.timestamp >= start && value.timestamp <= end;
        });

        return {
            pageVisits,
            transitions,
            dailyStats,
        };
    }

    async clearData(beforeDate?: string): Promise<void> {
        const date = beforeDate || formatDateForStats(Date.now() - 30 * 24 * 60 * 60 * 1000);

        await this.pageVisitDAO.deleteBeforeDate(date);
        await this.pageTransitionDAO.deleteBeforeDate(date);
        await this.dailyStatsDAO.deleteBeforeDate(date);

        this.logger.info("Data cleared", { beforeDate: date });
    }

    private startPeriodicUpdate(): void {
        setInterval(async () => {
            for (const [tabId, state] of this.tabStates) {
                if (state.isActive) {
                    await this.updateVisitDuration(state);
                }
            }
        }, 60000);
    }

    private scheduleCleanup(): void {
        const runCleanup = async () => {
            if (this.config?.retentionDays) {
                const cutoffDate = formatDateForStats(
                    Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000
                );
                await this.clearData(cutoffDate);
            }
        };

        setTimeout(runCleanup, 60000);
        setInterval(runCleanup, 24 * 60 * 60 * 1000);
    }
}
