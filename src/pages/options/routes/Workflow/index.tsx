import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Table,
  Message,
  Popconfirm,
  Typography,
  Switch,
  Space,
  Modal,
  Form,
  Input,
} from "@arco-design/web-react";
import { IconPlus, IconDelete, IconCopy, IconEdit } from "@arco-design/web-react/icon";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { Workflow } from "@App/app/repo/workflow";
import { formatUnixTime } from "@App/pkg/utils/day_format";
import { WorkflowClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";
import { useTranslation } from "react-i18next";

const { Title } = Typography;
const FormItem = Form.Item;

const WorkflowList: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const workflowClient = new WorkflowClient(message);

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workflowClient.getAllWorkflows();
      setWorkflows(data);
    } catch (e: any) {
      Message.error(`${t("workflow_page.load_failed")}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleCreate = async () => {
    try {
      await form.validate();
      const values = form.getFieldsValue();

      const newWorkflow = await workflowClient.createWorkflow({
        key: values.key || `workflow_${Date.now()}`,
        name: values.name,
        description: values.description || "",
        nodes: [
          {
            id: "start",
            type: "start",
            name: "Start",
            data: { name: "Start" },
            position: { x: 100, y: 200 },
          },
          {
            id: "end",
            type: "end",
            name: "End",
            data: { name: "End" },
            position: { x: 600, y: 200 },
          },
        ],
        edges: [],
        variables: {},
        enabled: true,
      });

      setCreateModalVisible(false);
      form.resetFields();
      navigate(`/workflow/editor/${newWorkflow.id}`);
    } catch (e: any) {
      Message.error(`${t("workflow_page.create_failed")}: ${e.message}`);
    }
  };

  const handleRowClick = (record: Workflow) => {
    navigate(`/workflow/editor/${record.id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await workflowClient.deleteWorkflow(id);
      Message.success(t("delete_success"));
      loadWorkflows();
    } catch (e: any) {
      Message.error(`${t("delete_failed")}: ${e.message}`);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await workflowClient.toggleWorkflow(id, enabled);
      loadWorkflows();
    } catch (e: any) {
      Message.error(`${t("workflow_page.operation_failed")}: ${e.message}`);
    }
  };

  const handleCopy = (record: Workflow, e: React.MouseEvent<Element, MouseEvent>) => {
    e.stopPropagation();
    navigate("/workflow/editor", {
      state: { copyFrom: record },
    });
  };

  const columns: ColumnProps<Workflow>[] = [
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
      title: t("workflow_page.workflow_name"),
      dataIndex: "name",
      width: 200,
      render: (text) => (
        <a className="cursor-pointer hover:text-blue-500" onClick={(e) => e.stopPropagation()}>
          {text}
        </a>
      ),
    },
    {
      title: t("workflow_page.key"),
      dataIndex: "key",
      width: 150,
      render: (text) => <code className="text-xs bg-gray-100 px-1 rounded">{text}</code>,
    },
    {
      title: t("description"),
      dataIndex: "description",
      width: 250,
      render: (text) => <span className="text-gray-500">{text || "-"}</span>,
    },
    {
      title: t("workflow_page.node_count"),
      dataIndex: "nodes",
      width: 100,
      render: (nodes) => <span>{nodes?.length || 0}</span>,
    },
    {
      title: t("csp_rule_page.create_time"),
      dataIndex: "createtime",
      width: 150,
      render: (time) => formatUnixTime(time / 1000),
    },
    {
      title: t("workflow_page.update_time"),
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
            icon={<IconEdit />}
            onClick={(e: Event) => {
              e.stopPropagation();
              navigate(`/workflow/editor/${record.id}`);
            }}
          >
            {t("edit")}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconCopy />}
            onClick={(e: Event) => handleCopy(record, e as unknown as React.MouseEvent)}
          >
            {t("workflow_page.copy")}
          </Button>
          <Popconfirm
            title={t("workflow_page.confirm_delete")}
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
          <Title heading={5}>{t("workflow_page.title")}</Title>
          <Button type="primary" icon={<IconPlus />} onClick={() => setCreateModalVisible(true)}>
            {t("workflow_page.add_workflow")}
          </Button>
        </div>
        <Table
          columns={columns}
          data={workflows}
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

      <Modal
        title={t("workflow_page.create_workflow")}
        visible={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        okText={t("confirm")}
        cancelText={t("close")}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label={t("workflow_page.workflow_name")}
            field="name"
            rules={[{ required: true, message: t("workflow_page.name_required") }]}
          >
            <Input placeholder={t("workflow_page.name_placeholder")} />
          </FormItem>
          <FormItem
            label={t("workflow_page.key")}
            field="key"
            rules={[
              { required: false },
              {
                validator: (value, callback) => {
                  if (value && !/^[a-zA-Z0-9_]+$/.test(value)) {
                    callback(t("workflow_page.key_format_error"));
                  } else {
                    callback();
                  }
                },
              },
            ]}
          >
            <Input placeholder={t("workflow_page.key_placeholder")} />
          </FormItem>
          <FormItem label={t("description")} field="description">
            <Input.TextArea placeholder={t("workflow_page.description_placeholder")} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowList;
