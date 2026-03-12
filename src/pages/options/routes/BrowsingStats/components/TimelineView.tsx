import React from "react";
import { Card, Timeline, Typography, Space, Tag, Empty } from "@arco-design/web-react";
import { IconClockCircle, IconLink } from "@arco-design/web-react/icon";
import type { TimelineEntry } from "@App/app/repo/browsingStats";
import { useTranslation } from "react-i18next";

const { Text, Title } = Typography;

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

  if (entries.length === 0) {
    return (
      <Card bordered={false} style={{ height: "100%" }}>
        <Empty description={t("no_timeline_data")} />
      </Card>
    );
  }

  return (
    <Card bordered={false} style={{ height: "100%", overflow: "auto" }}>
      <Timeline mode="left">
        {entries.map((entry, index) => {
          const prevEntry = index > 0 ? entries[index - 1] : null;
          const showGap = prevEntry && entry.startTime - (prevEntry.endTime || prevEntry.startTime) > 5 * 60 * 1000;

          return (
            <React.Fragment key={entry.id}>
              {showGap && (
                <Timeline.Item
                  dot={<IconClockCircle style={{ fontSize: 16 }} />}
                  style={{ opacity: 0.5 }}
                >
                  <Text type="secondary">
                    {t("time_gap")}
                  </Text>
                </Timeline.Item>
              )}
              <Timeline.Item
                label={formatTime(entry.startTime)}
                dot={
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "var(--color-primary-6)",
                    }}
                  />
                }
              >
                <Card
                  hoverable
                  style={{ marginBottom: 8, cursor: "pointer" }}
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
                      <IconLink style={{ color: "var(--color-text-3)" }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {getDomainFromUrl(entry.url)}
                      </Text>
                    </Space>
                    {entry.referrer && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {t("from")}: {getDomainFromUrl(entry.referrer)}
                      </Text>
                    )}
                  </Space>
                </Card>
              </Timeline.Item>
            </React.Fragment>
          );
        })}
      </Timeline>
    </Card>
  );
};

export default TimelineView;
