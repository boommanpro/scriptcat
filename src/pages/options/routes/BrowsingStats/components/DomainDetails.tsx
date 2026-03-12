import React from "react";
import { Card, Typography, Space, Tag, Button, Empty, Table } from "@arco-design/web-react";
import { IconLeft, IconLink } from "@arco-design/web-react/icon";
import type { TimelineEntry } from "@App/app/repo/browsingStats";
import { useTranslation } from "react-i18next";

const { Text, Title } = Typography;

interface DomainDetailsProps {
  domain: string;
  entries: TimelineEntry[];
  onBack: () => void;
  onSelectPage: (url: string) => void;
}

const DomainDetails: React.FC<DomainDetailsProps> = ({ domain, entries, onBack, onSelectPage }) => {
  const { t } = useTranslation();

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
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

  const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
  const uniquePages = new Set(entries.map((e) => e.url)).size;

  const columns = [
    {
      title: t("page"),
      dataIndex: "title",
      key: "title",
      width: 400,
      render: (title: string, record: TimelineEntry) => (
        <Space direction="vertical" size="small">
          <Text bold style={{ maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title || record.url}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.url}
          </Text>
        </Space>
      ),
    },
    {
      title: t("start_time"),
      dataIndex: "startTime",
      key: "startTime",
      width: 120,
      render: (startTime: number) => (
        <Text type="secondary">{formatTime(startTime)}</Text>
      ),
    },
    {
      title: t("duration"),
      dataIndex: "duration",
      key: "duration",
      width: 100,
      render: (duration: number) => <Tag color="arcoblue">{formatDuration(duration)}</Tag>,
    },
  ];

  if (!entries || entries.length === 0) {
    return (
      <Card bordered={false} style={{ height: "calc(100vh - 200px)", overflow: "auto" }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Button icon={<IconLeft />} onClick={onBack}>
            {t("back")}
          </Button>
          <Empty description={t("no_page_data")} />
        </Space>
      </Card>
    );
  }

  return (
    <Card bordered={false} style={{ height: "calc(100vh - 200px)", overflow: "auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Button icon={<IconLeft />} onClick={onBack}>
            {t("back")}
          </Button>
          <Space>
            <Tag color="green">{entries.length} {t("visits")}</Tag>
            <Tag color="blue">{uniquePages} {t("unique_pages")}</Tag>
            <Tag color="orange">{formatDuration(totalDuration)}</Tag>
          </Space>
        </Space>

        <Card bordered={false} style={{ background: "var(--color-fill-1)" }}>
          <Space direction="vertical" size="small">
            <Title heading={5} style={{ margin: 0 }}>
              <IconLink style={{ marginRight: 8 }} />
              {domain}
            </Title>
            <Space>
              <Text type="secondary">
                {t("first_visit")}: {formatDate(entries[0].startTime)} {formatTime(entries[0].startTime)}
              </Text>
              <Text type="secondary">|</Text>
              <Text type="secondary">
                {t("last_visit")}: {formatDate(entries[entries.length - 1].startTime)} {formatTime(entries[entries.length - 1].startTime)}
              </Text>
            </Space>
          </Space>
        </Card>

        <Card bordered={false} title={t("timeline")}>
          <Table
            data={entries}
            columns={columns}
            pagination={{ pageSize: 20 }}
            size="small"
            onRow={(record) => ({
              onClick: () => onSelectPage(record.url),
              style: { cursor: "pointer" },
            })}
          />
        </Card>
      </Space>
    </Card>
  );
};

export default DomainDetails;
