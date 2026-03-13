import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Table, Message, Popconfirm, Typography, Switch, Space } from "@arco-design/web-react";
import { IconPlus, IconDelete, IconCopy } from "@arco-design/web-react/icon";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { AutomationScript } from "@App/app/repo/automationScript";
import { formatUnixTime } from "@App/pkg/utils/day_format";
import { AutomationScriptClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";
import { useTranslation } from "react-i18next";

const { Title } = Typography;

const AutomationScriptManage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [scripts, setScripts] = useState<AutomationScript[]>([]);
  const [loading, setLoading] = useState(false);

  const automationClient = new AutomationScriptClient(message);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await automationClient.getAllScripts();
      setScripts(data);
    } catch (e: any) {
      Message.error(`${t("automation_script_page.load_failed")}: ${e.message}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const handleAdd = () => {
    navigate("/automation-script/editor");
  };

  const handleRowClick = (record: AutomationScript) => {
    navigate(`/automation-script/editor/${record.id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await automationClient.deleteScript(id);
      Message.success(t("delete_success"));
      loadScripts();
    } catch (e: any) {
      Message.error(`${t("delete_failed")}: ${e.message}`);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await automationClient.toggleScript(id, enabled);
      loadScripts();
    } catch (e: any) {
      Message.error(`${t("automation_script_page.operation_failed")}: ${e.message}`);
    }
  };

  const handleCopy = (record: AutomationScript, e: React.MouseEvent<Element, MouseEvent>) => {
    e.stopPropagation();
    navigate("/automation-script/editor", {
      state: { copyFrom: record },
    });
  };

  const columns: ColumnProps<AutomationScript>[] = [
    {
      title: t("enable"),
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
      title: t("automation_script_page.script_name"),
      dataIndex: "name",
      width: 150,
      render: (text) => (
        <a className="cursor-pointer hover:text-blue-500" onClick={(e) => e.stopPropagation()}>
          {text}
        </a>
      ),
    },
    {
      title: t("automation_script_page.key"),
      dataIndex: "key",
      width: 150,
      render: (text) => <code className="text-xs bg-gray-100 px-1 rounded">{text}</code>,
    },
    {
      title: t("description"),
      dataIndex: "description",
      width: 200,
      render: (text) => <span className="text-gray-500">{text || "-"}</span>,
    },
    {
      title: t("automation_script_page.target_url"),
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
      title: t("csp_rule_page.create_time"),
      dataIndex: "createtime",
      width: 150,
      render: (time) => formatUnixTime(time / 1000),
    },
    {
      title: t("automation_script_page.update_time"),
      dataIndex: "updatetime",
      width: 150,
      render: (time) => formatUnixTime(time / 1000),
    },
    {
      title: t("action"),
      width: 140,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconCopy />}
            onClick={(e: Event) => handleCopy(record, e as unknown as React.MouseEvent)}
          >
            {t("automation_script_page.copy")}
          </Button>
          <Popconfirm
            title={t("automation_script_page.confirm_delete")}
            onOk={() => handleDelete(record.id)}
            okText={t("confirm")}
            cancelText={t("close")}
          >
            <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={(e) => e.stopPropagation()}>
              {t("delete")}
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
          <Title heading={5}>{t("automation_script_page.title")}</Title>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            {t("automation_script_page.add_script")}
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
