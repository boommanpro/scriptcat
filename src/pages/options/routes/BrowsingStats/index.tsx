import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Tabs,
  Statistic,
  Grid,
  DatePicker,
  Button,
  Table,
  Space,
  Typography,
  Switch,
  Message,
  Modal,
  Input,
  Tag,
  Empty,
  Spin,
} from "@arco-design/web-react";
import {
  IconFile,
  IconSettings,
  IconExport,
  IconDelete,
  IconClockCircle,
  IconLink,
  IconDriveFile,
} from "@arco-design/web-react/icon";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import type {
  DailyStats,
  BrowsingStatsConfig,
  TimelineEntry,
  DomainStats,
  PageStats,
} from "@App/app/repo/browsingStats";
import { formatDateForStats } from "@App/app/repo/browsingStats";
import TimelineView from "./components/TimelineView";
import PageDetails from "./components/PageDetails";

const { Row, Col } = Grid;
const { Title, Text } = Typography;

const BrowsingStats: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<BrowsingStatsConfig | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [statsRange, setStatsRange] = useState<DailyStats[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const dateStr = useMemo(() => formatDateForStats(selectedDate.toDate()), [selectedDate]);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config?.enabled) {
      loadDailyStats(dateStr);
    }
  }, [dateStr, config?.enabled]);

  const loadConfig = async () => {
    try {
      const response = await sendMessage("getConfig", {});
      setConfig(response as BrowsingStatsConfig);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const loadDailyStats = async (date: string) => {
    setLoading(true);
    try {
      const response = await sendMessage("getDailyStats", { date });
      setDailyStats(response as DailyStats);
    } catch (error) {
      console.error("Failed to load daily stats:", error);
      setDailyStats(null);
    } finally {
      setLoading(false);
    }
  };

  const loadStatsRange = async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      const response = await sendMessage("getStatsRange", { startDate, endDate });
      setStatsRange(response as DailyStats[]);
    } catch (error) {
      console.error("Failed to load stats range:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = async (updates: Partial<BrowsingStatsConfig>) => {
    try {
      const newConfig = await sendMessage("updateConfig", updates);
      setConfig(newConfig as BrowsingStatsConfig);
      Message.success(t("settings_saved"));
    } catch (error) {
      Message.error(t("settings_save_failed"));
    }
  };

  const handleExport = async () => {
    try {
      const startDate = formatDateForStats(selectedDate.subtract(7, "day").toDate());
      const endDate = dateStr;
      const data = await sendMessage("exportData", { startDate, endDate });

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `browsing-stats-${startDate}-${endDate}.json`;
      a.click();
      URL.revokeObjectURL(url);

      Message.success(t("export_success"));
      setShowExport(false);
    } catch (error) {
      Message.error(t("export_failed"));
    }
  };

  const handleClearData = async () => {
    Modal.confirm({
      title: t("confirm_clear_data"),
      content: t("confirm_clear_data_desc"),
      onOk: async () => {
        try {
          await sendMessage("clearData", {});
          Message.success(t("clear_success"));
          loadDailyStats(dateStr);
        } catch (error) {
          Message.error(t("clear_failed"));
        }
      },
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

  const domainColumns = [
    {
      title: t("domain"),
      dataIndex: "domain",
      key: "domain",
      render: (domain: string) => (
        <Text bold style={{ color: "var(--color-text-1)" }}>
          {domain}
        </Text>
      ),
    },
    {
      title: t("visit_count"),
      dataIndex: "visitCount",
      key: "visitCount",
      sorter: (a: DomainStats, b: DomainStats) => a.visitCount - b.visitCount,
      render: (count: number) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: t("duration"),
      dataIndex: "totalDuration",
      key: "totalDuration",
      sorter: (a: DomainStats, b: DomainStats) => a.totalDuration - b.totalDuration,
      render: (duration: number) => formatDuration(duration),
    },
  ];

  const pageColumns = [
    {
      title: t("page"),
      dataIndex: "title",
      key: "title",
      render: (title: string, record: PageStats) => (
        <a
          href={record.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-text-1)", textDecoration: "none" }}
          onClick={(e) => {
            e.preventDefault();
            setSelectedPageUrl(record.url);
          }}
        >
          {title || record.url}
        </a>
      ),
    },
    {
      title: t("visit_count"),
      dataIndex: "visitCount",
      key: "visitCount",
      sorter: (a: PageStats, b: PageStats) => a.visitCount - b.visitCount,
      render: (count: number) => <Tag color="green">{count}</Tag>,
    },
    {
      title: t("duration"),
      dataIndex: "totalDuration",
      key: "totalDuration",
      sorter: (a: PageStats, b: PageStats) => a.totalDuration - b.totalDuration,
      render: (duration: number) => formatDuration(duration),
    },
  ];

  if (!config?.enabled) {
    return (
      <Card bordered={false} style={{ height: "100%" }}>
        <Empty
          description={
            <Space direction="vertical" align="center">
              <Text>{t("browsing_stats_disabled")}</Text>
              <Button
                type="primary"
                onClick={() => {
                  setShowSettings(true);
                }}
              >
                {t("enable_browsing_stats")}
              </Button>
            </Space>
          }
        />
        <SettingsModal
          visible={showSettings}
          config={config}
          onClose={() => setShowSettings(false)}
          onSave={handleConfigChange}
        />
      </Card>
    );
  }

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            <DatePicker
              value={selectedDate}
              onChange={(date) => setSelectedDate(dayjs(date))}
              style={{ width: 200 }}
            />
            <Button onClick={() => setSelectedDate(dayjs())}>{t("today")}</Button>
          </Space>
          <Space>
            <Button icon={<IconSettings />} onClick={() => setShowSettings(true)}>
              {t("settings")}
            </Button>
            <Button icon={<IconExport />} onClick={() => setShowExport(true)}>
              {t("export")}
            </Button>
            <Button icon={<IconDelete />} status="danger" onClick={handleClearData}>
              {t("clear_data")}
            </Button>
          </Space>
        </Space>
      </Card>

      <Tabs activeTab={activeTab} onChange={setActiveTab} style={{ height: "calc(100% - 80px)" }}>
        <Tabs.TabPane key="overview" title={<span><IconDriveFile /> {t("overview")}</span>}>
          <Spin loading={loading} style={{ width: "100%" }}>
            {dailyStats ? (
              <Space direction="vertical" style={{ width: "100%" }} size="large">
                <Row gutter={16}>
                  <Col span={6}>
                    <Card bordered={false}>
                      <Statistic
                        title={t("total_visits")}
                        value={dailyStats.totalVisits}
                        prefix={<IconFile />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bordered={false}>
                      <Statistic
                        title={t("total_duration")}
                        value={formatDuration(dailyStats.totalDuration)}
                        prefix={<IconClockCircle />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bordered={false}>
                      <Statistic
                        title={t("unique_domains")}
                        value={dailyStats.uniqueDomains}
                        prefix={<IconLink />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bordered={false}>
                      <Statistic
                        title={t("unique_pages")}
                        value={dailyStats.uniquePages}
                        prefix={<IconFile />}
                      />
                    </Card>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Card bordered={false} title={t("top_domains")}>
                      <Table
                        data={dailyStats.topDomains}
                        columns={domainColumns}
                        pagination={false}
                        size="small"
                        scroll={{ y: 300 }}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card bordered={false} title={t("hourly_distribution")}>
                      <HourlyDistributionChart data={dailyStats.hourlyDistribution} />
                    </Card>
                  </Col>
                </Row>

                <Card bordered={false} title={t("top_pages")}>
                  <Table
                    data={dailyStats.topPages}
                    columns={pageColumns}
                    pagination={{ pageSize: 10 }}
                    size="small"
                    scroll={{ y: 300 }}
                    onRow={(record) => ({
                      onClick: () => setSelectedPageUrl(record.url),
                      style: { cursor: "pointer" },
                    })}
                  />
                </Card>
              </Space>
            ) : (
              <Empty description={t("no_data_for_date")} />
            )}
          </Spin>
        </Tabs.TabPane>

        <Tabs.TabPane key="timeline" title={<span><IconClockCircle /> {t("timeline")}</span>}>
          <TimelineView
            entries={dailyStats?.timeline || []}
            onSelectPage={setSelectedPageUrl}
          />
        </Tabs.TabPane>
      </Tabs>

      {selectedPageUrl && (
        <PageDetails
          url={selectedPageUrl}
          onClose={() => setSelectedPageUrl(null)}
        />
      )}

      <SettingsModal
        visible={showSettings}
        config={config}
        onClose={() => setShowSettings(false)}
        onSave={handleConfigChange}
      />

      <Modal
        title={t("export_data")}
        visible={showExport}
        onOk={handleExport}
        onCancel={() => setShowExport(false)}
      >
        <Text>{t("export_data_desc")}</Text>
      </Modal>
    </div>
  );
};

const HourlyDistributionChart: React.FC<{ data: number[] }> = ({ data }) => {
  const max = Math.max(...data, 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: 200, gap: 4 }}>
      {data.map((value, hour) => (
        <div
          key={hour}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "100%",
          }}
        >
          <div
            style={{
              width: "100%",
              background: "var(--color-primary-6)",
              height: `${(value / max) * 100}%`,
              minHeight: value > 0 ? 4 : 0,
              borderRadius: 2,
            }}
          />
          <Text style={{ fontSize: 10, marginTop: 4 }}>{hour}</Text>
        </div>
      ))}
    </div>
  );
};

const SettingsModal: React.FC<{
  visible: boolean;
  config: BrowsingStatsConfig | null;
  onClose: () => void;
  onSave: (updates: Partial<BrowsingStatsConfig>) => void;
}> = ({ visible, config, onClose, onSave }) => {
  const { t } = useTranslation();
  const defaultConfig: BrowsingStatsConfig = {
    enabled: false,
    trackIncognito: false,
    excludedDomains: [],
    excludedPatterns: [],
    retentionDays: 30,
    syncEnabled: false,
    lastSyncTime: null,
  };
  const [localConfig, setLocalConfig] = useState<BrowsingStatsConfig>(config || defaultConfig);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    } else {
      setLocalConfig(defaultConfig);
    }
  }, [config]);

  return (
    <Modal
      title={t("browsing_stats_settings")}
      visible={visible}
      onOk={() => {
        onSave(localConfig);
        onClose();
      }}
      onCancel={onClose}
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text>{t("enable_tracking")}</Text>
          <Switch
            checked={localConfig.enabled}
            onChange={(checked) => setLocalConfig({ ...localConfig, enabled: checked })}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text>{t("track_incognito")}</Text>
          <Switch
            checked={localConfig.trackIncognito}
            onChange={(checked) => setLocalConfig({ ...localConfig, trackIncognito: checked })}
          />
        </div>

        <div>
          <Text>{t("excluded_domains")}</Text>
          <Input.TextArea
            value={localConfig.excludedDomains.join("\n")}
            onChange={(value) =>
              setLocalConfig({
                ...localConfig,
                excludedDomains: value.split("\n").filter(Boolean),
              })
            }
            placeholder={t("excluded_domains_placeholder")}
            rows={4}
          />
        </div>

        <div>
          <Text>{t("retention_days")}</Text>
          <Input
            type="number"
            value={String(localConfig.retentionDays)}
            onChange={(value) =>
              setLocalConfig({
                ...localConfig,
                retentionDays: parseInt(value) || 30,
              })
            }
          />
        </div>
      </Space>
    </Modal>
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

export default BrowsingStats;
