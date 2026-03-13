(function () {
    "use strict";

    const STATS_MESSAGE_PREFIX = "browsingStats_";
    let isInitialized = false;
    let lastUrl = window.location.href;
    let lastTitle = document.title;
    let isActive = true;
    let lastActivityTime = Date.now();
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    function log(...args: any[]): void {
        console.log("[Browsing Stats]", new Date().toISOString(), ...args);
    }

    function sendMessage(type: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                log("Sending message:", type, data);
                chrome.runtime.sendMessage(
                    {
                        action: STATS_MESSAGE_PREFIX + type,
                        data: {
                            ...data,
                            url: window.location.href,
                            title: document.title,
                        },
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            log("Message error:", chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            log("Message response:", response);
                            resolve(response);
                        }
                    }
                );
            } catch (error) {
                log("Message send failed:", error);
                reject(error);
            }
        });
    }

    function notifyVisitStart(): void {
        log("notifyVisitStart:", window.location.href);
        sendMessage("visitStart", {
            url: window.location.href,
            title: document.title,
            referrer: document.referrer || null,
            timestamp: Date.now(),
        }).catch(() => { });
    }

    function notifyVisitEnd(): void {
        log("notifyVisitEnd:", lastUrl);
        sendMessage("visitEnd", {
            url: lastUrl,
            timestamp: Date.now(),
        }).catch(() => { });
    }

    function notifyPageFocus(): void {
        log("notifyPageFocus:", window.location.href);
        isActive = true;
        lastActivityTime = Date.now();
        sendMessage("pageFocus", {
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
        }).catch(() => { });
    }

    function notifyPageBlur(): void {
        if (isActive) {
            log("notifyPageBlur:", window.location.href);
            isActive = false;
            sendMessage("pageBlur", {
                url: window.location.href,
                timestamp: Date.now(),
                activeDuration: Date.now() - lastActivityTime,
            }).catch(() => { });
        }
    }

    function checkUrlChange(): void {
        const currentUrl = window.location.href;
        const currentTitle = document.title;

        if (currentUrl !== lastUrl) {
            log("URL changed from:", lastUrl, "to:", currentUrl);
            notifyVisitEnd();
            lastUrl = currentUrl;
            lastTitle = currentTitle;
            notifyVisitStart();
        } else if (currentTitle !== lastTitle) {
            log("Title changed to:", currentTitle);
            lastTitle = currentTitle;
        }
    }

    function handleVisibilityChange(): void {
        log("visibility changed to:", document.visibilityState);
        if (document.visibilityState === "visible") {
            notifyPageFocus();
        } else {
            notifyPageBlur();
        }
    }

    function handleWindowFocus(): void {
        log("window focused");
        notifyPageFocus();
    }

    function handleWindowBlur(): void {
        log("window blurred");
        notifyPageBlur();
    }

    function handleBeforeUnload(): void {
        log("before unload");
        notifyVisitEnd();
    }

    function startHeartbeat(): void {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }

        heartbeatInterval = setInterval(() => {
            if (isActive) {
                log("heartbeat");
                sendMessage("heartbeat", {
                    url: window.location.href,
                    title: document.title,
                    isActive: true,
                    timestamp: Date.now(),
                }).catch(() => { });
            }
        }, 30000);
    }

    function init(): void {
        if (isInitialized) {
            log("Already initialized, skipping");
            return;
        }

        log("Initializing content script...");
        log("Protocol:", window.location.protocol);
        log("URL:", window.location.href);

        if (window.location.protocol === "chrome:" ||
            window.location.protocol === "chrome-extension:" ||
            window.location.protocol === "about:") {
            log("Skipping internal page");
            return;
        }

        isInitialized = true;

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleWindowFocus);
        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("popstate", checkUrlChange);
        window.addEventListener("hashchange", checkUrlChange);

        const originalPushState = history.pushState;
        history.pushState = function (...args) {
            const result = originalPushState.apply(this, args);
            log("history.pushState called");
            setTimeout(checkUrlChange, 0);
            return result;
        };

        const originalReplaceState = history.replaceState;
        history.replaceState = function (...args) {
            const result = originalReplaceState.apply(this, args);
            log("history.replaceState called");
            setTimeout(checkUrlChange, 0);
            return result;
        };

        notifyVisitStart();

        if (document.visibilityState === "visible") {
            notifyPageFocus();
        }

        startHeartbeat();

        log("Content script initialized successfully");
    }

    log("Script loaded, readyState:", document.readyState);
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
