import React, { useState } from "react";
import { Tabs, Button, Checkbox, Empty, Input, Badge } from "@arco-design/web-react";
import type { NetworkRequest, ConsoleLog } from "@App/pkg/ai/types";

interface MonitorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  networkRequests: NetworkRequest[];
  consoleLogs: ConsoleLog[];
  onToggleNetworkRequest: (id: string) => void;
  onToggleConsoleLog: (id: string) => void;
  onSelectAllNetwork: (selected: boolean) => void;
  onSelectAllConsole: (selected: boolean) => void;
  onClearNetwork: () => void;
  onClearConsole: () => void;
  onInsertSelected: () => void;
  getLogLevelColor: (level: ConsoleLog["level"]) => string;
  isRecording: boolean;
  onToggleRecording: () => void;
}

const TabPane = Tabs.TabPane;

export const MonitorPanel: React.FC<MonitorPanelProps> = ({
  isOpen,
  onClose,
  networkRequests,
  consoleLogs,
  onToggleNetworkRequest,
  onToggleConsoleLog,
  onSelectAllNetwork,
  onSelectAllConsole,
  onClearNetwork,
  onClearConsole,
  onInsertSelected,
  getLogLevelColor,
  isRecording,
  onToggleRecording,
}) => {
  const [activeTab, setActiveTab] = useState("network");
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");

  if (!isOpen) return null;

  const selectedNetworkCount = networkRequests.filter((r) => r.selected).length;
  const selectedConsoleCount = consoleLogs.filter((l) => l.selected).length;
  const totalSelected = selectedNetworkCount + selectedConsoleCount;

  // 统计
  const networkSuccess = networkRequests.filter((r) => r.status && r.status >= 200 && r.status < 300).length;
  const networkError = networkRequests.filter((r) => r.status && r.status >= 400).length;
  const networkPending = networkRequests.filter((r) => !r.status).length;

  const consoleLogCount = consoleLogs.filter((l) => l.level === "log").length;
  const consoleInfoCount = consoleLogs.filter((l) => l.level === "info").length;
  const consoleWarnCount = consoleLogs.filter((l) => l.level === "warn").length;
  const consoleErrorCount = consoleLogs.filter((l) => l.level === "error").length;

  // 过滤
  const filteredNetworkRequests = networkRequests.filter((r) =>
    filterText
      ? r.url.toLowerCase().includes(filterText.toLowerCase()) ||
        r.method.toLowerCase().includes(filterText.toLowerCase())
      : true
  );

  const filteredConsoleLogs = consoleLogs.filter((l) =>
    filterText
      ? l.message.toLowerCase().includes(filterText.toLowerCase()) ||
        (l.source && l.source.toLowerCase().includes(filterText.toLowerCase()))
      : true
  );

  const formatMethod = (method: string) => {
    const colors: Record<string, string> = {
      GET: "#165dff",
      POST: "#00b42a",
      PUT: "#ff7d00",
      DELETE: "#f53f3f",
      PATCH: "#f7ba1e",
    };
    const bgColors: Record<string, string> = {
      GET: "#e8f3ff",
      POST: "#e8ffea",
      PUT: "#fff7e8",
      DELETE: "#ffe8e8",
      PATCH: "#fffbe8",
    };
    return (
      <span
        style={{
          color: colors[method] || "#86909c",
          background: bgColors[method] || "#f2f3f5",
          fontWeight: 600,
          fontSize: "11px",
          padding: "2px 8px",
          borderRadius: "4px",
          minWidth: "45px",
          display: "inline-block",
          textAlign: "center",
        }}
      >
        {method}
      </span>
    );
  };

  const formatStatus = (status?: number) => {
    if (!status) {
      return (
        <span style={{ color: "#ff7d00", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
          <span className="monitor-status-dot pending" />
          Pending
        </span>
      );
    }
    let color = "#00b42a";
    let bgColor = "#e8ffea";
    if (status >= 400) {
      color = "#f53f3f";
      bgColor = "#ffe8e8";
    } else if (status >= 300) {
      color = "#ff7d00";
      bgColor = "#fff7e8";
    }
    return (
      <span
        style={{
          color,
          background: bgColor,
          fontWeight: 500,
          fontSize: "11px",
          padding: "2px 8px",
          borderRadius: "4px",
        }}
      >
        {status}
      </span>
    );
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="monitor-sidebar">
      {/* 头部 */}
      <div className="monitor-sidebar-header">
        <div className="monitor-header-title">
          <span className="monitor-icon">🔍</span>
          <span>开发者工具</span>
          {isRecording && <span className="monitor-recording-badge">监控中</span>}
        </div>
        <div className="monitor-header-actions">
          <Button
            size="mini"
            type={isRecording ? "primary" : "secondary"}
            status={isRecording ? "danger" : undefined}
            onClick={onToggleRecording}
          >
            {isRecording ? "⏹ 暂停监控" : "⏺ 开始监控"}
          </Button>
          <Button size="mini" type="secondary" onClick={activeTab === "network" ? onClearNetwork : onClearConsole}>
            🗑 清空
          </Button>
          <button className="monitor-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {/* 标题 */}
      <div className="monitor-title-section">
        <div className="monitor-title">开发者工具 - 网络 & 控制台监控</div>
      </div>

      {/* Tabs */}
      <div className="monitor-tabs-section">
        <Tabs activeTab={activeTab} onChange={setActiveTab} size="small" type="line" className="monitor-tabs">
          <TabPane
            key="network"
            title={
              <span className="monitor-tab-title">
                <span className="monitor-tab-icon">🌐</span>
                网络监控
                <Badge count={networkRequests.length} className="monitor-badge" />
              </span>
            }
          />
          <TabPane
            key="console"
            title={
              <span className="monitor-tab-title">
                <span className="monitor-tab-icon">📋</span>
                控制台监控
                <Badge count={consoleLogs.length} className="monitor-badge" />
              </span>
            }
          />
        </Tabs>
      </div>

      {/* 统计栏 */}
      <div className="monitor-stats-section">
        {activeTab === "network" ? (
          <>
            <Button size="mini" type="primary" className="monitor-test-btn">
              🌐 测试网络请求
            </Button>
            <div className="monitor-stats">
              <span className="monitor-stat">
                <span className="monitor-stat-dot" />
                总计: {networkRequests.length}
              </span>
              <span className="monitor-stat success">
                <span className="monitor-stat-dot success" />
                成功: {networkSuccess}
              </span>
              <span className="monitor-stat error">
                <span className="monitor-stat-dot error" />
                错误: {networkError}
              </span>
              <span className="monitor-stat pending">
                <span className="monitor-stat-dot pending" />
                进行中: {networkPending}
              </span>
            </div>
          </>
        ) : (
          <>
            <Button size="mini" type="primary" className="monitor-test-btn">
              📋 测试控制台输出
            </Button>
            <div className="monitor-stats">
              <span className="monitor-stat">
                <span className="monitor-stat-dot" />
                总计: {consoleLogs.length}
              </span>
              <span className="monitor-stat">
                <span className="monitor-stat-dot log" />
                日志: {consoleLogCount}
              </span>
              <span className="monitor-stat info">
                <span className="monitor-stat-dot info" />
                信息: {consoleInfoCount}
              </span>
              <span className="monitor-stat warn">
                <span className="monitor-stat-dot warn" />
                警告: {consoleWarnCount}
              </span>
              <span className="monitor-stat error">
                <span className="monitor-stat-dot error" />
                错误: {consoleErrorCount}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 过滤器 */}
      <div className="monitor-filter-section">
        <Input
          size="small"
          placeholder={activeTab === "network" ? "🔍 过滤URL或方法..." : "🔍 过滤消息内容或来源..."}
          value={filterText}
          onChange={setFilterText}
          className="monitor-filter-input"
          allowClear
        />
        <select className="monitor-filter-select">
          <option>所有状态</option>
        </select>
      </div>

      {/* 列表头部 */}
      <div className="monitor-list-header-bar">
        <Checkbox
          checked={
            activeTab === "network"
              ? networkRequests.length > 0 && networkRequests.every((r) => r.selected)
              : consoleLogs.length > 0 && consoleLogs.every((l) => l.selected)
          }
          indeterminate={
            activeTab === "network"
              ? selectedNetworkCount > 0 && selectedNetworkCount < networkRequests.length
              : selectedConsoleCount > 0 && selectedConsoleCount < consoleLogs.length
          }
          onChange={(checked) => (activeTab === "network" ? onSelectAllNetwork(checked) : onSelectAllConsole(checked))}
        >
          全选
        </Checkbox>
        <Button size="mini" type="secondary" disabled={totalSelected === 0} onClick={onInsertSelected}>
          ⬇ 导出选中 ({totalSelected})
        </Button>
      </div>

      {/* 列表内容 */}
      <div className="monitor-list-content">
        {activeTab === "network" && (
          <>
            {filteredNetworkRequests.length === 0 ? (
              <div className="monitor-empty">
                <Empty description="暂无网络请求" />
              </div>
            ) : (
              filteredNetworkRequests.map((request) => (
                <div key={request.id} className={`monitor-list-item ${request.selected ? "selected" : ""}`}>
                  <div className="monitor-item-row">
                    <Checkbox
                      checked={request.selected}
                      onChange={() => onToggleNetworkRequest(request.id)}
                      className="monitor-item-checkbox"
                    />
                    <span
                      className="monitor-item-expand"
                      onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                    >
                      {expandedRequest === request.id ? "▼" : "▶"}
                    </span>
                    {formatMethod(request.method)}
                    <span className="monitor-item-url" title={request.url}>
                      {request.url}
                    </span>
                    <span className="monitor-item-type">fetch</span>
                  </div>
                  <div className="monitor-item-row secondary">
                    <span className="monitor-item-time">{formatTime(request.timestamp)}</span>
                    {formatStatus(request.status)}
                    <span className="monitor-item-duration">{request.time || "0"}ms</span>
                    <span className="monitor-item-size">0</span>
                  </div>
                  {expandedRequest === request.id && (
                    <div className="monitor-item-details">
                      <div className="monitor-detail-row">
                        <span className="monitor-detail-label">URL:</span>
                        <span className="monitor-detail-value">{request.url}</span>
                      </div>
                      {request.requestHeaders && Object.keys(request.requestHeaders).length > 0 && (
                        <div className="monitor-detail-row">
                          <span className="monitor-detail-label">请求头:</span>
                          <pre className="monitor-detail-code">{JSON.stringify(request.requestHeaders, null, 2)}</pre>
                        </div>
                      )}
                      {request.responseHeaders && Object.keys(request.responseHeaders).length > 0 && (
                        <div className="monitor-detail-row">
                          <span className="monitor-detail-label">响应头:</span>
                          <pre className="monitor-detail-code">{JSON.stringify(request.responseHeaders, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "console" && (
          <>
            {filteredConsoleLogs.length === 0 ? (
              <div className="monitor-empty">
                <Empty description="暂无控制台日志" />
              </div>
            ) : (
              filteredConsoleLogs.map((log) => (
                <div key={log.id} className={`monitor-list-item ${log.selected ? "selected" : ""}`}>
                  <div className="monitor-item-row">
                    <Checkbox
                      checked={log.selected}
                      onChange={() => onToggleConsoleLog(log.id)}
                      className="monitor-item-checkbox"
                    />
                    <span
                      className="monitor-item-expand"
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      {expandedLog === log.id ? "▼" : "▶"}
                    </span>
                    <span
                      className="monitor-log-level-badge"
                      style={{
                        background: getLogLevelColor(log.level),
                        color: log.level === "log" ? "#1d2129" : "#fff",
                      }}
                    >
                      {log.level.toUpperCase()}
                    </span>
                    <span
                      className="monitor-log-message"
                      title={log.message}
                      style={{ color: getLogLevelColor(log.level) }}
                    >
                      {log.message}
                    </span>
                  </div>
                  <div className="monitor-item-row secondary">
                    <span className="monitor-item-time">{formatTime(log.timestamp)}</span>
                    {log.source && (
                      <span className="monitor-log-source">
                        📄 {log.source} 行: {log.line}, 列: {log.column}
                      </span>
                    )}
                  </div>
                  {expandedLog === log.id && (
                    <div className="monitor-item-details">
                      <div className="monitor-detail-row">
                        <span className="monitor-detail-label">消息:</span>
                        <pre className="monitor-detail-code">{log.message}</pre>
                      </div>
                      {log.stack && (
                        <div className="monitor-detail-row">
                          <span className="monitor-detail-label">堆栈:</span>
                          <pre className="monitor-detail-code">{log.stack}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};
