import React, { useEffect, useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Message,
  Tag,
  Table,
  Space,
  Modal,
  Typography,
  Divider,
  Badge,
  Tooltip,
  Empty,
  Spin,
} from "@arco-design/web-react";
import {
  IconLink,
  IconUser,
  IconRefresh,
  IconDelete,
  IconCheck,
  IconClose,
  IconCloud,
} from "@arco-design/web-react/icon";
import { useTranslation } from "react-i18next";

const { Title, Text } = Typography;
const FormItem = Form.Item;

interface CloudConnectionConfig {
  serverUrl: string;
  username: string;
  autoReconnect: boolean;
  reconnectInterval: number;
  heartbeatInterval: number;
}

interface CloudConnectionStatus {
  connected: boolean;
  connecting: boolean;
  lastHeartbeat?: number;
  reconnectAttempts: number;
  error?: string;
}

interface ScriptReportConfig {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  metadata?: any;
}

interface CommunicationLog {
  id: string;
  timestamp: number;
  direction: "send" | "receive";
  type: string;
  action: string;
  data: any;
  success?: boolean;
  error?: string;
}

const defaultConfig: CloudConnectionConfig = {
  serverUrl: "ws://localhost:8080/ws",
  username: "",
  autoReconnect: true,
  reconnectInterval: 5,
  heartbeatInterval: 30,
};

const CloudControl: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<CloudConnectionConfig>(defaultConfig);
  const [status, setStatus] = useState<CloudConnectionStatus>({
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
  });
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [scripts, setScripts] = useState<ScriptReportConfig[]>([]);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig();
    loadStatus();
    loadScripts();

    const handleMessage = (message: any) => {
      switch (message.action) {
        case "cloud_status_change":
          setStatus(message.status);
          break;
        case "cloud_log":
          setLogs((prev) => [message.log, ...prev].slice(0, 1000));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const loadConfig = async () => {
    const result = await chrome.storage.local.get(["cloud_config"]);
    if (result.cloud_config) {
      setConfig(result.cloud_config);
    }
  };

  const loadStatus = async () => {
    const response = await chrome.runtime.sendMessage({ action: "cloud_get_status" });
    if (response?.status) {
      setStatus(response.status);
    }
  };

  const loadScripts = async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ action: "cloud_get_scripts" });
      if (response?.scripts) {
        setScripts(response.scripts);
      }
    } catch (error) {
      Message.error("加载脚本列表失败");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!config.username) {
      Message.error("请输入用户名");
      return;
    }

    if (!config.serverUrl) {
      Message.error("请输入服务器地址");
      return;
    }

    await chrome.storage.local.set({ cloud_config: config });

    const response = await chrome.runtime.sendMessage({
      action: "cloud_connect",
      config,
    });

    if (response?.success) {
      Message.success("连接成功");
      loadStatus();
    } else {
      Message.error(`连接失败: ${response?.error || "未知错误"}`);
    }
  };

  const handleDisconnect = async () => {
    await chrome.runtime.sendMessage({ action: "cloud_disconnect" });
    Message.info("已断开连接");
    loadStatus();
  };

  const handleSyncScripts = async () => {
    if (!status.connected) {
      Message.warning("未连接到服务器");
      return;
    }
    await chrome.runtime.sendMessage({ action: "cloud_sync_scripts" });
    Message.success("脚本列表已同步");
  };

  const handleToggleScriptReport = async (scriptId: string, enabled: boolean) => {
    await chrome.runtime.sendMessage({
      action: "cloud_set_script_config",
      scriptId,
      enabled,
    });
    setScripts((prev) => prev.map((s) => (s.id === scriptId ? { ...s, enabled } : s)));
    Message.success(enabled ? "已启用上报" : "已禁用上报");
  };

  const handleClearLogs = async () => {
    await chrome.runtime.sendMessage({ action: "cloud_clear_logs" });
    setLogs([]);
    Message.success("日志已清空");
  };

  const handleGetLogs = async () => {
    const response = await chrome.runtime.sendMessage({ action: "cloud_get_logs" });
    if (response?.logs) {
      setLogs(response.logs);
    }
    setLogModalVisible(true);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const renderStatusBadge = () => {
    if (status.connecting) {
      return <Badge status="processing" text="连接中..." />;
    }
    if (status.connected) {
      return <Badge status="success" text="已连接" />;
    }
    return <Badge status="default" text="未连接" />;
  };

  return (
    <div className="cloud-control" style={{ padding: 20 }}>
      <Title heading={4}>
        <IconCloud /> {t("cloud_control")}
      </Title>

      <Card title="连接配置" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <FormItem label="服务器地址" required>
            <Input
              prefix={<IconLink />}
              placeholder="ws://localhost:8080/ws"
              value={config.serverUrl}
              onChange={(value) => setConfig({ ...config, serverUrl: value })}
              disabled={status.connected}
            />
          </FormItem>

          <FormItem label="用户名" required>
            <Input
              prefix={<IconUser />}
              placeholder="请输入用户名"
              value={config.username}
              onChange={(value) => setConfig({ ...config, username: value })}
              disabled={status.connected}
            />
          </FormItem>

          <FormItem
            label={
              <span>
                自动重连{" "}
                <Switch
                  checked={config.autoReconnect}
                  onChange={(checked) => setConfig({ ...config, autoReconnect: checked })}
                />
              </span>
            }
          >
            <Space>
              <Text type="secondary">重连间隔:</Text>
              <Input
                type="number"
                style={{ width: 80 }}
                value={String(config.reconnectInterval)}
                onChange={(value) => setConfig({ ...config, reconnectInterval: parseInt(value) || 5 })}
                suffix="秒"
                disabled={!config.autoReconnect}
              />
              <Text type="secondary">心跳间隔:</Text>
              <Input
                type="number"
                style={{ width: 80 }}
                value={String(config.heartbeatInterval)}
                onChange={(value) => setConfig({ ...config, heartbeatInterval: parseInt(value) || 30 })}
                suffix="秒"
              />
            </Space>
          </FormItem>

          <FormItem>
            <Space>
              {!status.connected ? (
                <Button type="primary" onClick={handleConnect} loading={status.connecting}>
                  连接
                </Button>
              ) : (
                <Button type="outline" status="danger" onClick={handleDisconnect}>
                  断开连接
                </Button>
              )}
              <Button onClick={handleSyncScripts} disabled={!status.connected}>
                同步脚本
              </Button>
              <Button onClick={handleGetLogs}>查看日志</Button>
            </Space>
          </FormItem>
        </Form>

        <Divider />

        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text type="secondary">连接状态: </Text>
            {renderStatusBadge()}
          </div>
          {status.lastHeartbeat && (
            <div>
              <Text type="secondary">最后心跳: </Text>
              <Text>{formatTime(status.lastHeartbeat)}</Text>
            </div>
          )}
          {status.error && (
            <div>
              <Text type="secondary">错误信息: </Text>
              <Text type="error">{status.error}</Text>
            </div>
          )}
        </Space>
      </Card>

      <Card title="脚本上报配置" style={{ marginBottom: 16 }}>
        <Spin loading={loading} style={{ width: "100%" }}>
          {scripts.length > 0 ? (
            <Table
              data={scripts}
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: "脚本名称",
                  dataIndex: "name",
                  key: "name",
                },
                {
                  title: "脚本Key",
                  dataIndex: "key",
                  key: "key",
                  render: (key: string) => <Text code>{key}</Text>,
                },
                {
                  title: "上报状态",
                  dataIndex: "enabled",
                  key: "enabled",
                  render: (enabled: boolean, record: ScriptReportConfig) => (
                    <Switch checked={enabled} onChange={(checked) => handleToggleScriptReport(record.id, checked)} />
                  ),
                },
                {
                  title: "操作",
                  key: "action",
                  render: (_, record: ScriptReportConfig) => (
                    <Space>
                      <Tooltip content={record.enabled ? "禁用上报" : "启用上报"}>
                        <Button
                          size="small"
                          type="text"
                          icon={record.enabled ? <IconClose /> : <IconCheck />}
                          onClick={() => handleToggleScriptReport(record.id, !record.enabled)}
                        />
                      </Tooltip>
                    </Space>
                  ),
                },
              ]}
            />
          ) : (
            <Empty description="暂无脚本" />
          )}
        </Spin>
      </Card>

      <Modal
        title="通信日志"
        visible={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={
          <Space>
            <Button onClick={handleClearLogs}>清空日志</Button>
            <Button type="primary" onClick={() => setLogModalVisible(false)}>
              关闭
            </Button>
          </Space>
        }
        style={{ width: 900 }}
      >
        <Table
          data={logs.slice(0, 100)}
          pagination={{ pageSize: 20 }}
          scroll={{ y: 400 }}
          columns={[
            {
              title: "时间",
              dataIndex: "timestamp",
              key: "timestamp",
              width: 100,
              render: (timestamp: number) => formatTime(timestamp),
            },
            {
              title: "方向",
              dataIndex: "direction",
              key: "direction",
              width: 80,
              render: (direction: string) => (
                <Tag color={direction === "send" ? "blue" : "green"}>{direction === "send" ? "发送" : "接收"}</Tag>
              ),
            },
            {
              title: "类型",
              dataIndex: "type",
              key: "type",
              width: 100,
            },
            {
              title: "操作",
              dataIndex: "action",
              key: "action",
              width: 150,
            },
            {
              title: "数据",
              dataIndex: "data",
              key: "data",
              render: (data: any) => (
                <Tooltip content={<pre style={{ maxWidth: 400 }}>{JSON.stringify(data, null, 2)}</pre>}>
                  <Text style={{ maxWidth: 200 }} ellipsis>
                    {JSON.stringify(data)}
                  </Text>
                </Tooltip>
              ),
            },
            {
              title: "状态",
              key: "status",
              width: 80,
              render: (_, record: CommunicationLog) =>
                record.success === undefined ? (
                  <Tag>-</Tag>
                ) : record.success ? (
                  <Tag color="green">成功</Tag>
                ) : (
                  <Tooltip content={record.error}>
                    <Tag color="red">失败</Tag>
                  </Tooltip>
                ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default CloudControl;
