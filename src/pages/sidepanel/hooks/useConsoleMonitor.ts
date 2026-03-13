import { useState, useCallback, useRef, useEffect } from "react";
import type { ConsoleLog } from "@App/pkg/ai/types";

export const useConsoleMonitor = () => {
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const logCounterRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const currentTabIdRef = useRef<number | null>(null);

  // 同步 isRecording 状态到 ref
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // 注入监控脚本的函数
  const injectMonitorScript = useCallback(async (tabId: number) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          // 避免重复注入
          if ((window as any).__consoleMonitorInjected) {
            (window as any).__consoleMonitorEnabled = true;
            return { success: true, message: "Already injected" };
          }

          (window as any).__consoleMonitorInjected = true;
          (window as any).__consoleMonitorEnabled = true;
          (window as any).__consoleMonitorData = [];

          const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug,
          };

          let logIdCounter = 0;
          const generateId = () => `log-${++logIdCounter}-${Date.now()}`;

          const addEntry = (
            level: string,
            message: string,
            source: string,
            line: number | null,
            column: number | null
          ) => {
            if (!(window as any).__consoleMonitorEnabled) return;
            if (!(window as any).__consoleMonitorData) {
              (window as any).__consoleMonitorData = [];
            }
            (window as any).__consoleMonitorData.push({
              type: "CONSOLE_LOG",
              data: {
                id: generateId(),
                level,
                message,
                source,
                line,
                column,
                timestamp: Date.now(),
              },
            });
          };

          const getStackTrace = () => {
            try {
              throw new Error("Stack trace");
            } catch (error) {
              return (error as Error).stack || "";
            }
          };

          const getSourceInfo = (stack: string) => {
            if (!stack) return { source: "unknown", line: null as number | null, column: null as number | null };

            const lines = stack.split("\n");
            for (let i = 2; i < lines.length; i++) {
              const line = lines[i];
              if (line && !line.includes("console") && !line.includes("__console")) {
                const match = line.match(/\s+at\s+.*\s*\(?(https?:\/\/[^:]+):(\d+):(\d+)\)?/);
                if (match) {
                  return {
                    source: match[1].split("/").pop()?.split("?")[0] || "unknown",
                    line: parseInt(match[2]),
                    column: parseInt(match[3]),
                  };
                }
              }
            }
            return { source: "unknown", line: null, column: null };
          };

          const createLogEntry = (level: string, args: any[]) => {
            const message = args
              .map((arg: any) => {
                if (typeof arg === "object") {
                  try {
                    return JSON.stringify(arg);
                  } catch {
                    return String(arg);
                  }
                }
                return String(arg);
              })
              .join(" ");

            const stack = getStackTrace();
            const { source, line, column } = getSourceInfo(stack);

            return { message, source, line, column };
          };

          const wrapConsoleMethod = (methodName: string) => {
            console[methodName] = function (...args: any[]) {
              if (
                args.some(
                  (arg: any) =>
                    typeof arg === "string" && (arg.includes("[Console Monitor]") || arg.includes("__console"))
                )
              ) {
                return originalConsole[methodName as keyof typeof originalConsole].apply(console, args);
              }

              if ((window as any).__consoleMonitorEnabled) {
                const { message, source, line, column } = createLogEntry(methodName, args);
                addEntry(methodName, message, source, line, column);
              }

              return originalConsole[methodName as keyof typeof originalConsole].apply(console, args);
            };
          };

          Object.keys(originalConsole).forEach((method: string) => {
            wrapConsoleMethod(method);
          });

          window.addEventListener("error", (event) => {
            if (!(window as any).__consoleMonitorEnabled) return;

            addEntry(
              "error",
              `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
              event.filename?.split("/").pop()?.split("?")[0] || "unknown",
              event.lineno,
              event.colno
            );
          });

          window.addEventListener("unhandledrejection", (event) => {
            if (!(window as any).__consoleMonitorEnabled) return;

            addEntry("error", `Unhandled Promise Rejection: ${event.reason}`, "unknown", null, null);

            event.preventDefault();
          });

          console.log("[Console Monitor] Injected successfully");
          return { success: true };
        },
      });
    } catch (error) {
      console.error("注入控制台监控脚本失败:", error);
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
      if (message.type === "CONSOLE_LOG") {
        const log: ConsoleLog = {
          id: message.data.id,
          level: message.data.level,
          message: message.data.message,
          source: message.data.source,
          line: message.data.line,
          column: message.data.column,
          timestamp: message.data.timestamp,
          selected: false,
        };
        setConsoleLogs((prev) => [...prev, log]);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // 监听标签页更新事件（页面刷新）
    const handleTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status === "complete" && isRecordingRef.current && currentTabIdRef.current === tabId) {
        console.log("[Console Monitor] Tab refreshed, re-injecting script...");
        // 页面刷新后重新注入脚本
        setTimeout(() => {
          injectMonitorScript(tabId);
        }, 500);
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
          // 切换标签页时重新注入
          if (isRecordingRef.current) {
            await injectMonitorScript(tab.id);
          }
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: () => {
            const data = (window as any).__consoleMonitorData;
            if (data && data.length > 0) {
              (window as any).__consoleMonitorData = [];
              return data;
            }
            return [];
          },
        });

        const entries = results[0]?.result || [];
        entries.forEach((entry: any) => {
          if (entry.type === "CONSOLE_LOG") {
            handleMessage({ type: "CONSOLE_LOG", data: entry.data });
          }
        });
      } catch (_error) {
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
  }, [isRecording, injectMonitorScript]);

  const startRecording = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    setIsRecording(true);
    currentTabIdRef.current = tab.id;

    // 注入监控脚本
    await injectMonitorScript(tab.id);
  }, [injectMonitorScript]);

  const stopRecording = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setIsRecording(false);
      currentTabIdRef.current = null;
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => {
          (window as any).__consoleMonitorEnabled = false;
          console.log("[Console Monitor] Disabled");
        },
      });
    } catch (error) {
      console.error("停止控制台监听失败:", error);
    }
    setIsRecording(false);
    currentTabIdRef.current = null;
  }, []);

  const clearLogs = useCallback(() => {
    setConsoleLogs([]);
    logCounterRef.current = 0;
  }, []);

  const addLog = useCallback((log: ConsoleLog) => {
    setConsoleLogs((prev) => [...prev, log]);
  }, []);

  const toggleLogSelection = useCallback((id: string) => {
    setConsoleLogs((prev) => prev.map((log) => (log.id === id ? { ...log, selected: !log.selected } : log)));
  }, []);

  const selectAllLogs = useCallback((selected: boolean) => {
    setConsoleLogs((prev) => prev.map((log) => ({ ...log, selected })));
  }, []);

  const getSelectedLogs = useCallback(() => {
    return consoleLogs.filter((log) => log.selected);
  }, [consoleLogs]);

  const getLogById = useCallback(
    (id: string) => {
      return consoleLogs.find((log) => log.id === id);
    },
    [consoleLogs]
  );

  const formatLogForPrompt = useCallback((log: ConsoleLog) => {
    const lines = [
      `### Console ${log.level.toUpperCase()}`,
      `- **时间**: ${new Date(log.timestamp).toLocaleTimeString()}`,
      `- **内容**:\n\`\`\`\n${log.message}\n\`\`\``,
    ];

    if (log.source) {
      lines.push(`- **来源**: ${log.source}${log.line ? `:${log.line}` : ""}`);
    }

    return lines.join("\n");
  }, []);

  const insertSelectedLogs = useCallback(() => {
    const selected = getSelectedLogs();
    if (selected.length === 0) return "";
    return selected.map(formatLogForPrompt).join("\n\n");
  }, [getSelectedLogs, formatLogForPrompt]);

  const getLogLevelColor = useCallback((level: ConsoleLog["level"]) => {
    switch (level) {
      case "error":
        return "#f53f3f";
      case "warn":
        return "#ff7d00";
      case "info":
        return "#165dff";
      case "debug":
        return "#86909c";
      default:
        return "#1d2129";
    }
  }, []);

  return {
    consoleLogs,
    isRecording,
    startRecording,
    stopRecording,
    clearLogs,
    addLog,
    toggleLogSelection,
    selectAllLogs,
    getSelectedLogs,
    getLogById,
    formatLogForPrompt,
    insertSelectedLogs,
    getLogLevelColor,
  };
};
