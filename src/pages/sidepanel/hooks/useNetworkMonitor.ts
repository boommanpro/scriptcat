import { useState, useCallback, useRef, useEffect } from "react";
import type { NetworkRequest } from "@App/pkg/ai/types";

export const useNetworkMonitor = () => {
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const requestMapRef = useRef<Map<string, NetworkRequest>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const currentTabIdRef = useRef<number | null>(null);

  // 同步 isRecording 状态到 ref
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // 启用监控的函数
  const enableMonitor = useCallback(async (tabId: number) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          if ((window as any).__networkMonitorInjected) {
            (window as any).__networkMonitorEnabled = true;
            console.log("[Network Monitor] Enabled");
            return { success: true };
          }
          return { success: false, error: "Monitor not injected" };
        },
      });
    } catch (error) {
      console.error("启用网络监控失败:", error);
    }
  }, []);

  // 禁用监控的函数
  const disableMonitor = useCallback(async (tabId: number) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          if ((window as any).__networkMonitorInjected) {
            (window as any).__networkMonitorEnabled = false;
            console.log("[Network Monitor] Disabled");
          }
        },
      });
    } catch (error) {
      console.error("禁用网络监控失败:", error);
    }
  }, []);

  // 监听来自 content script 的消息和页面刷新
  useEffect(() => {
    if (!isRecording) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      currentTabIdRef.current = null;
      return;
    }

    const handleMessage = (message: any) => {
      if (message.type === "NETWORK_REQUEST") {
        const request: NetworkRequest = {
          id: message.data.id,
          url: message.data.url,
          method: message.data.method,
          requestHeaders: message.data.requestHeaders,
          requestBody: message.data.requestBody,
          timestamp: message.data.timestamp,
          selected: false,
        };
        requestMapRef.current.set(request.id, request);
        setNetworkRequests((prev) => {
          const exists = prev.find((r) => r.id === request.id);
          if (exists) {
            return prev.map((r) => (r.id === request.id ? { ...r, ...request } : r));
          }
          return [...prev, request];
        });
      } else if (message.type === "NETWORK_RESPONSE") {
        const updates: Partial<NetworkRequest> = {
          status: message.data.status,
          statusText: message.data.statusText,
          responseHeaders: message.data.responseHeaders,
          time: message.data.duration,
        };
        const existing = requestMapRef.current.get(message.data.id);
        if (existing) {
          const updated = { ...existing, ...updates };
          requestMapRef.current.set(message.data.id, updated);
          setNetworkRequests((prev) => prev.map((r) => (r.id === message.data.id ? updated : r)));
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // 监听标签页更新事件（页面刷新）
    const handleTabUpdated = (tabId: number, changeInfo: any) => {
      if (changeInfo.status === "complete" && isRecordingRef.current && currentTabIdRef.current === tabId) {
        console.log("[Network Monitor] Tab refreshed, re-enabling monitor...");
        // 页面刷新后重新启用监控（content script 会自动重新注入）
        setTimeout(() => {
          enableMonitor(tabId);
        }, 100);
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    // 定期从页面获取数据
    intervalRef.current = setInterval(async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;

        // 记录当前标签页 ID
        if (currentTabIdRef.current !== tab.id) {
          currentTabIdRef.current = tab.id;
          // 切换标签页时启用监控
          if (isRecordingRef.current) {
            await enableMonitor(tab.id);
          }
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: () => {
            const data = (window as any).__networkMonitorData;
            if (data && data.length > 0) {
              (window as any).__networkMonitorData = [];
              return data;
            }
            return [];
          },
        });

        const entries = results[0]?.result || [];
        entries.forEach((entry: any) => {
          if (entry.type === "NETWORK_REQUEST") {
            handleMessage({ type: "NETWORK_REQUEST", data: entry.data });
          } else if (entry.type === "NETWORK_RESPONSE") {
            handleMessage({ type: "NETWORK_RESPONSE", data: entry.data });
          }
        });
      } catch (error) {
        // 忽略错误
      }
    }, 500);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRecording, enableMonitor]);

  const startRecording = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    setIsRecording(true);
    currentTabIdRef.current = tab.id;

    // 启用监控
    await enableMonitor(tab.id);
  }, [enableMonitor]);

  const stopRecording = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await disableMonitor(tab.id);
    }
    setIsRecording(false);
    currentTabIdRef.current = null;
  }, [disableMonitor]);

  const clearRequests = useCallback(() => {
    setNetworkRequests([]);
    requestMapRef.current.clear();
  }, []);

  const addRequest = useCallback((request: NetworkRequest) => {
    requestMapRef.current.set(request.id, request);
    setNetworkRequests((prev) => {
      const exists = prev.find((r) => r.id === request.id);
      if (exists) {
        return prev.map((r) => (r.id === request.id ? { ...r, ...request } : r));
      }
      return [...prev, request];
    });
  }, []);

  const updateRequest = useCallback((id: string, updates: Partial<NetworkRequest>) => {
    const existing = requestMapRef.current.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      requestMapRef.current.set(id, updated);
      setNetworkRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    }
  }, []);

  const toggleRequestSelection = useCallback((id: string) => {
    setNetworkRequests((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  }, []);

  const selectAllRequests = useCallback((selected: boolean) => {
    setNetworkRequests((prev) => prev.map((r) => ({ ...r, selected })));
  }, []);

  const getSelectedRequests = useCallback(() => {
    return networkRequests.filter((r) => r.selected);
  }, [networkRequests]);

  const getRequestById = useCallback((id: string) => {
    return requestMapRef.current.get(id);
  }, []);

  const formatRequestForPrompt = useCallback((request: NetworkRequest) => {
    const lines = [
      `### 网络请求: ${request.method} ${request.url}`,
      `- **状态**: ${request.status || "Pending"} ${request.statusText || ""}`,
      `- **时间**: ${new Date(request.timestamp).toLocaleTimeString()}`,
    ];

    if (request.requestHeaders && Object.keys(request.requestHeaders).length > 0) {
      lines.push(`- **请求头**:`);
      Object.entries(request.requestHeaders).forEach(([key, value]) => {
        lines.push(`  - ${key}: ${value}`);
      });
    }

    if (request.requestBody) {
      lines.push(`- **请求体**:`);
      lines.push(`\`\`\`json\n${request.requestBody.substring(0, 1000)}\n\`\`\``);
    }

    if (request.responseHeaders && Object.keys(request.responseHeaders).length > 0) {
      lines.push(`- **响应头**:`);
      Object.entries(request.responseHeaders).forEach(([key, value]) => {
        lines.push(`  - ${key}: ${value}`);
      });
    }

    return lines.join("\n");
  }, []);

  const insertSelectedRequests = useCallback(() => {
    const selected = getSelectedRequests();
    if (selected.length === 0) return "";
    return selected.map(formatRequestForPrompt).join("\n\n");
  }, [getSelectedRequests, formatRequestForPrompt]);

  return {
    networkRequests,
    isRecording,
    startRecording,
    stopRecording,
    clearRequests,
    addRequest,
    updateRequest,
    toggleRequestSelection,
    selectAllRequests,
    getSelectedRequests,
    getRequestById,
    formatRequestForPrompt,
    insertSelectedRequests,
  };
};
