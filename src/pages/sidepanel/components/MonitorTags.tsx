import React from "react";
import type { NetworkRequest, ConsoleLog } from "@App/pkg/ai/types";
import { useTranslation } from "react-i18next";

interface MonitorTagsProps {
  selectedNetworkRequests: NetworkRequest[];
  selectedConsoleLogs: ConsoleLog[];
  onRemoveNetworkRequest: (id: string) => void;
  onRemoveConsoleLog: (id: string) => void;
  onInsertAll: () => void;
  getLogLevelColor: (level: ConsoleLog["level"]) => string;
}

export const MonitorTags: React.FC<MonitorTagsProps> = ({
  selectedNetworkRequests,
  selectedConsoleLogs,
  onRemoveNetworkRequest,
  onRemoveConsoleLog,
  onInsertAll,
  getLogLevelColor,
}) => {
  const { t } = useTranslation();
  const totalCount = selectedNetworkRequests.length + selectedConsoleLogs.length;

  if (totalCount === 0) return null;

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url.length > 30 ? url.substring(0, 30) + "..." : url;
    }
  };

  return (
    <div className="monitor-tags">
      <div className="monitor-tags-header">
        <button className="insert-all-btn" onClick={onInsertAll}>
          {`${t("monitor.insert_all")} (${totalCount})`}
        </button>
      </div>
      <div className="monitor-tags-list">
        {selectedNetworkRequests.map((request) => (
          <div key={request.id} className="monitor-tag network-tag">
            <span className="monitor-tag-method">{request.method}</span>
            <span className="monitor-tag-text" title={request.url}>
              {formatUrl(request.url)}
            </span>
            <span
              className="monitor-tag-remove"
              onClick={() => onRemoveNetworkRequest(request.id)}
              title={t("monitor.remove")}
            >
              {"×"}
            </span>
          </div>
        ))}
        {selectedConsoleLogs.map((log) => (
          <div key={log.id} className="monitor-tag console-tag">
            <span
              className="monitor-tag-level"
              style={{
                background: getLogLevelColor(log.level),
                color: log.level === "log" ? "#1d2129" : "#fff",
              }}
            >
              {log.level}
            </span>
            <span className="monitor-tag-text" title={log.message}>
              {log.message.length > 30 ? log.message.substring(0, 30) + "..." : log.message}
            </span>
            <span className="monitor-tag-remove" onClick={() => onRemoveConsoleLog(log.id)} title={t("monitor.remove")}>
              {"×"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
