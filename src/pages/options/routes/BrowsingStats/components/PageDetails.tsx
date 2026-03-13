import React, { useEffect, useState } from "react";
import { Drawer, Card, Space, Typography, Tag, Table, Spin, Empty, Descriptions } from "@arco-design/web-react";
import { IconClockCircle, IconFile } from "@arco-design/web-react/icon";
import { useTranslation } from "react-i18next";

const { Text, Title } = Typography;

interface PageDetailsProps {
  url: string;
  onClose: () => void;
}

interface PageDetailsData {
  url: string;
  title: string;
  visitCount: number;
  totalDuration: number;
  firstVisit: number | null;
  lastVisit: number | null;
  referrers: { url: string; count: number }[];
  destinations: { url: string; count: number }[];
}

const PageDetails: React.FC<PageDetailsProps> = ({ url, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageDetailsData | null>(null);

  useEffect(() => {
    loadPageDetails();
  }, [url]);

  const loadPageDetails = async () => {
    setLoading(true);
    try {
      const response = await sendMessage("getPageDetails", { url });
      setData(response as PageDetailsData);
    } catch (error) {
      console.error("Failed to load page details:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleString("zh-CN");
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

  const referrerColumns = [
    {
      title: t("source_page"),
      dataIndex: "url",
      key: "url",
      render: (url: string) => (
        <Text style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {url}
        </Text>
      ),
    },
    {
      title: t("count"),
      dataIndex: "count",
      key: "count",
      render: (count: number) => <Tag color="green">{count}</Tag>,
    },
  ];

  const destinationColumns = [
    {
      title: t("destination_page"),
      dataIndex: "url",
      key: "url",
      render: (url: string) => (
        <Text style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {url}
        </Text>
      ),
    },
    {
      title: t("count"),
      dataIndex: "count",
      key: "count",
      render: (count: number) => <Tag color="blue">{count}</Tag>,
    },
  ];

  return (
    <Drawer
      title={t("page_details")}
      visible={true}
      onCancel={onClose}
      width={600}
      footer={null}
    >
      <Spin loading={loading} style={{ width: "100%" }}>
        {data ? (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Card bordered={false}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Title heading={5} style={{ margin: 0 }}>
                  {data.title || url}
                </Title>
                <Text type="secondary" style={{ fontSize: 12, wordBreak: "break-all" }}>
                  {url}
                </Text>
              </Space>
            </Card>

            <Card bordered={false}>
              <Descriptions
                column={2}
                border
                data={[
                  { label: <><IconFile /> {t("visit_count")}</>, value: <Tag color="arcoblue">{data.visitCount}</Tag> },
                  { label: <><IconClockCircle /> {t("total_duration")}</>, value: formatDuration(data.totalDuration) },
                  { label: t("first_visit"), value: formatTime(data.firstVisit) },
                  { label: t("last_visit"), value: formatTime(data.lastVisit) },
                ]}
              />
            </Card>

            <Card bordered={false} title={t("navigation_sources")}>
              {data.referrers.length > 0 ? (
                <Table
                  data={data.referrers}
                  columns={referrerColumns}
                  pagination={false}
                  size="small"
                  scroll={{ y: 200 }}
                />
              ) : (
                <Empty description={t("no_referrer_data")} />
              )}
            </Card>

            <Card bordered={false} title={t("navigation_destinations")}>
              {data.destinations.length > 0 ? (
                <Table
                  data={data.destinations}
                  columns={destinationColumns}
                  pagination={false}
                  size="small"
                  scroll={{ y: 200 }}
                />
              ) : (
                <Empty description={t("no_destination_data")} />
              )}
            </Card>
          </Space>
        ) : (
          <Empty description={t("no_page_data")} />
        )}
      </Spin>
    </Drawer>
  );
};

async function sendMessage(action: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: `browsingStats_${action}`,
        data,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}

export default PageDetails;
