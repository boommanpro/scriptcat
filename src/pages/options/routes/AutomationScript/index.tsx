import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Table,
  Space,
  Message,
  Popconfirm,
  Typography,
  Tag,
  Drawer,
  Tabs,
  Input,
  Switch,
} from "@arco-design/web-react";
import { IconPlus, IconEdit, IconDelete, IconPlayArrow, IconCode } from "@arco-design/web-react/icon";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { AutomationScript, AutomationTestLog } from "@App/app/repo/automationScript";
import { formatUnixTime } from "@App/pkg/utils/day_format";
import { AutomationScriptClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";

const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;

const AutomationScriptManage: React.FC = () => {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<AutomationScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [testDrawerVisible, setTestDrawerVisible] = useState(false);
  const [currentScript, setCurrentScript] = useState<AutomationScript | null>(null);
  const [testLogs, setTestLogs] = useState<AutomationTestLog[]>([]);
  const [testInput, setTestInput] = useState("{}");
  const [testRunning, setTestRunning] = useState(false);

  const automationClient = new AutomationScriptClient(message);

  const loadScripts = async () => {
    setLoading(true);
    try {
      const data = await automationClient.getAllScripts();
      setScripts(data);
    } catch (e: any) {
      Message.error(`加载脚本失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const handleAdd = () => {
    navigate("/automation-script/editor");
  };

  const handleEdit = (record: AutomationScript) => {
    navigate(`/automation-script/editor/${record.id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await automationClient.deleteScript(id);
      Message.success("删除成功");
      loadScripts();
    } catch (e: any) {
      Message.error(`删除失败: ${e.message}`);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await automationClient.toggleScript(id, enabled);
      loadScripts();
    } catch (e: any) {
      Message.error(`操作失败: ${e.message}`);
    }
  };

  const handleOpenTest = async (script: AutomationScript) => {
    setCurrentScript(script);
    setTestInput("{}");
    try {
      const logs = await automationClient.getTestLogs(script.key);
      setTestLogs(logs);
    } catch (e: any) {
      Message.error(`加载测试日志失败: ${e.message}`);
      setTestLogs([]);
    }
    setTestDrawerVisible(true);
  };

  const handleRunTest = async () => {
    if (!currentScript) return;

    setTestRunning(true);
    try {
      const log = await automationClient.runTest(currentScript.key, testInput);
      setTestLogs([log, ...testLogs]);
      if (log.status === "success") {
        Message.success("测试成功");
      } else {
        Message.error(`测试失败: ${log.error}`);
      }
    } catch (e: any) {
      Message.error(`测试失败: ${e.message}`);
    } finally {
      setTestRunning(false);
    }
  };

  const handleOpenTargetPage = async (scriptKey: string) => {
    try {
      await automationClient.openTargetPage(scriptKey);
      Message.success("已打开目标页面");
    } catch (e: any) {
      Message.error(`打开页面失败: ${e.message}`);
    }
  };

  const handleRerunLog = async (log: AutomationTestLog) => {
    setTestInput(log.inputJson);
  };

  const columns: ColumnProps<AutomationScript>[] = [
    {
      title: "启用",
      dataIndex: "enabled",
      width: 80,
      render: (enabled, record) => (
        <Switch checked={enabled} onChange={(checked) => handleToggle(record.id, checked)} />
      ),
    },
    {
      title: "脚本名称",
      dataIndex: "name",
      width: 150,
    },
    {
      title: "标识Key",
      dataIndex: "key",
      width: 150,
      render: (text) => <code className="text-xs bg-gray-100 px-1 rounded">{text}</code>,
    },
    {
      title: "描述",
      dataIndex: "description",
      width: 200,
      render: (text) => <span className="text-gray-500">{text || "-"}</span>,
    },
    {
      title: "目标网址",
      dataIndex: "targetUrl",
      width: 250,
      render: (text) =>
        text ? (
          <a href={text} target="_blank" rel="noopener noreferrer" className="text-xs truncate block max-w-full">
            {text}
          </a>
        ) : (
          "-"
        ),
    },
    {
      title: "创建时间",
      dataIndex: "createtime",
      width: 150,
      render: (time) => formatUnixTime(time / 1000),
    },
    {
      title: "更新时间",
      dataIndex: "updatetime",
      width: 150,
      render: (time) => formatUnixTime(time / 1000),
    },
    {
      title: "操作",
      width: 250,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="text" size="small" icon={<IconPlayArrow />} onClick={() => handleOpenTest(record)}>
            测试
          </Button>
          {record.targetUrl && (
            <Button type="text" size="small" icon={<IconCode />} onClick={() => handleOpenTargetPage(record.key)}>
              打开
            </Button>
          )}
          <Popconfirm title="确定删除此脚本吗？" onOk={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns: ColumnProps<AutomationTestLog>[] = [
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (status) => (
        <Tag color={status === "success" ? "green" : status === "error" ? "red" : "blue"}>
          {status === "success" ? "成功" : status === "error" ? "失败" : "运行中"}
        </Tag>
      ),
    },
    {
      title: "执行时间",
      dataIndex: "createtime",
      width: 150,
      render: (time) => formatUnixTime(time / 1000),
    },
    {
      title: "耗时(ms)",
      dataIndex: "duration",
      width: 100,
      render: (duration) => duration || "-",
    },
    {
      title: "错误信息",
      dataIndex: "error",
      width: 200,
      render: (error) => (error ? <Text type="error">{error}</Text> : "-"),
    },
    {
      title: "操作",
      width: 100,
      render: (_, record) => (
        <Button type="text" size="small" onClick={() => handleRerunLog(record)}>
          重新测试
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 h-full overflow-auto">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <Title heading={5}>自动化规则脚本</Title>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            添加脚本
          </Button>
        </div>
        <Table
          columns={columns}
          data={scripts}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showTotal: true,
          }}
        />
      </Card>

      <Drawer
        title={`测试脚本: ${currentScript?.name || ""}`}
        visible={testDrawerVisible}
        width={800}
        onCancel={() => setTestDrawerVisible(false)}
        footer={null}
      >
        {currentScript && (
          <Tabs defaultActiveTab="test">
            <TabPane key="test" title="测试执行">
              <Space direction="vertical" className="w-full">
                <div>
                  <Text bold>输入参数 (JSON格式)</Text>
                  <Input.TextArea
                    value={testInput}
                    onChange={setTestInput}
                    placeholder='{"key": "value"}'
                    rows={6}
                    className="mt-2"
                  />
                </div>
                <Button type="primary" icon={<IconPlayArrow />} onClick={handleRunTest} loading={testRunning}>
                  执行测试
                </Button>
              </Space>
            </TabPane>
            <TabPane key="logs" title="测试历史">
              <Table
                columns={logColumns}
                data={testLogs}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                }}
              />
            </TabPane>
          </Tabs>
        )}
      </Drawer>
    </div>
  );
};

export default AutomationScriptManage;
