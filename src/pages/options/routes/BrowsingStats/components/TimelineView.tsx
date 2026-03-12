import React from "react";
import { Card, Typography, Space, Tag, Empty } from "@arco-design/web-react";
import { IconLink } from "@arco-design/web-react/icon";
import type { TimelineEntry } from "@App/app/repo/browsingStats";
import { useTranslation } from "react-i18next";

const { Text } = Typography;

interface TimelineViewProps {
  entries: TimelineEntry[];
  onSelectPage: (url: string) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ entries, onSelectPage }) => {
  const { t } = useTranslation();

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getDomainFromUrl = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  if (!entries || entries.length === 0) {
    return (
      <Card bordered={false} style={{ height: "100%" }}>
        <Empty description={t("no_timeline_data")} />
      </Card>
    );
  }

  return (
    <Card bordered={false} style={{ height: "calc(100vh - 200px)", overflow: "auto" }}>
      <div style={{ padding: 16 }}>
        <Text bold style={{ marginBottom: 16, display: "block" }}>
          {t("timeline")} ({entries.length})
        </Text>
        {entries.map((entry) => {
          return (
            <div
              key={entry.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid var(--color-border-2)",
                cursor: "pointer",
              }}
              onClick={() => onSelectPage(entry.url)}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text bold style={{ maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.title || entry.url}
                  </Text>
                  <Tag color="arcoblue">{formatDuration(entry.duration)}</Tag>
                </Space>
                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatTime(entry.startTime)}
                  </Text>
                  <IconLink style={{ color: "var(--color-text-3)" }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {getDomainFromUrl(entry.url)}
                  </Text>
                </Space>
              </Space>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default TimelineView;
