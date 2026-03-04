import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Table, Message, Popconfirm, Typography, Switch, Space } from "@arco-design/web-react";
import { IconPlus, IconDelete, IconCopy } from "@arco-design/web-react/icon";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { AutomationScript } from "@App/app/repo/automationScript";
import { formatUnixTime } from "@App/pkg/utils/day_format";
import { AutomationScriptClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";

const { Title } = Typography;

const AutomationScriptManage: React.FC = () => {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<AutomationScript[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleRowClick = (record: AutomationScript) => {
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

  const handleCopy = (record: AutomationScript, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("/automation-script/editor", {
      state: { copyFrom: record },
    });
  };

  const columns: ColumnProps<AutomationScript>[] = [
    {
      title: "启用",
      dataIndex: "enabled",
      width: 80,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggle(record.id, checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      title: "脚本名称",
      dataIndex: "name",
      width: 150,
      render: (text) => (
        <a className="cursor-pointer hover:text-blue-500" onClick={(e) => e.stopPropagation()}>
          {text}
        </a>
      ),
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
          <a
            href={text}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs truncate block max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
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
      width: 140,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconCopy />}
            onClick={(e) => handleCopy(record, e)}
          >
            复制
          </Button>
          <Popconfirm title="确定删除此脚本吗？" onOk={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={(e) => e.stopPropagation()}>
              删除
            </Button>
          </Popconfirm>
        </Space>
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
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: "pointer" },
          })}
        />
      </Card>
    </div>
  );
};

export default AutomationScriptManage;
