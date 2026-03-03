import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Table,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Message,
  Popconfirm,
  Typography,
  Tag,
  Tooltip,
} from "@arco-design/web-react";
import { IconPlus, IconEdit, IconDelete, IconQuestionCircle } from "@arco-design/web-react/icon";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { CSPRule, CSPRuleAction } from "@App/app/repo/cspRule";
import { formatUnixTime } from "@App/pkg/utils/day_format";
import { CSPRuleClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";

const FormItem = Form.Item;
const { Title } = Typography;

const CSPRuleManage: React.FC = () => {
  const [rules, setRules] = useState<CSPRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<CSPRule | null>(null);
  const [form] = Form.useForm();

  const cspRuleClient = new CSPRuleClient(message);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await cspRuleClient.getAllRules();
      setRules(data);
    } catch (e: any) {
      Message.error(`加载规则失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleAdd = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      priority: 100,
      action: "remove",
    });
    setModalVisible(true);
  };

  const handleEdit = (record: CSPRule) => {
    setEditingRule(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await cspRuleClient.deleteRule(id);
      Message.success("删除成功");
      loadRules();
    } catch (e: any) {
      Message.error(`删除失败: ${e.message}`);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await cspRuleClient.toggleRule(id, enabled);
      loadRules();
    } catch (e: any) {
      Message.error(`操作失败: ${e.message}`);
    }
  };

  const handleSubmit = async () => {
    try {
      await form.validate();
      const values = form.getFieldsValue() as Omit<CSPRule, "id" | "createtime" | "updatetime">;

      if (editingRule) {
        await cspRuleClient.updateRule(editingRule.id, values);
        Message.success("更新成功");
      } else {
        await cspRuleClient.createRule(values);
        Message.success("创建成功");
      }
      setModalVisible(false);
      loadRules();
    } catch (e: any) {
      Message.error(`操作失败: ${e.message}`);
    }
  };

  const columns: ColumnProps<CSPRule>[] = [
    {
      title: "启用",
      dataIndex: "enabled",
      width: 80,
      render: (enabled, record) => (
        <Switch checked={enabled} onChange={(checked) => handleToggle(record.id, checked)} />
      ),
    },
    {
      title: "规则名称",
      dataIndex: "name",
      width: 150,
    },
    {
      title: "描述",
      dataIndex: "description",
      width: 200,
      render: (text) => <span className="text-gray-500">{text || "-"}</span>,
    },
    {
      title: (
        <Space>
          匹配路径
          <Tooltip content="支持通配符(*匹配任意字符)、正则表达式(用/包裹，如/https?:\/\/example\.com\/.*/i)">
            <IconQuestionCircle />
          </Tooltip>
        </Space>
      ),
      dataIndex: "path",
      width: 250,
      render: (text) => <code className="text-xs bg-gray-100 px-1 rounded">{text}</code>,
    },
    {
      title: "操作类型",
      dataIndex: "action",
      width: 100,
      render: (action: CSPRuleAction) => (
        <Tag color={action === "remove" ? "red" : "blue"}>
          {action === "remove" ? "移除CSP" : "修改CSP"}
        </Tag>
      ),
    },
    {
      title: "修改值",
      dataIndex: "actionValue",
      width: 200,
      render: (text, record) =>
        record.action === "modify" ? (
          <code className="text-xs bg-gray-100 px-1 rounded max-w-full truncate block">{text || "-"}</code>
        ) : (
          "-"
        ),
    },
    {
      title: "优先级",
      dataIndex: "priority",
      width: 80,
      sorter: (a, b) => a.priority - b.priority,
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
      width: 150,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除此规则吗？"
            onOk={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
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
          <Title heading={5}>CSP处理规则</Title>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            添加规则
          </Button>
        </div>
        <Table
          columns={columns}
          data={rules}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 20,
            showTotal: true,
          }}
        />
      </Card>

      <Modal
        title={editingRule ? "编辑规则" : "添加规则"}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        autoFocus={false}
        focusLock={true}
        style={{ width: 600 }}
      >
        <Form form={form} layout="vertical">
          <FormItem label="规则名称" field="name" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input placeholder="请输入规则名称" />
          </FormItem>
          <FormItem label="描述" field="description">
            <Input.TextArea placeholder="请输入规则描述" rows={2} />
          </FormItem>
          <FormItem
            label={
              <Space>
                匹配路径
                <Tooltip content="支持通配符(*匹配任意字符)、正则表达式(用/包裹)">
                  <IconQuestionCircle />
                </Tooltip>
              </Space>
            }
            field="path"
            rules={[{ required: true, message: "请输入匹配路径" }]}
          >
            <Input placeholder="例如: *://example.com/* 或 /https?:\/\/example\.com\/.*/i" />
          </FormItem>
          <FormItem label="操作类型" field="action" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="remove">移除CSP头</Select.Option>
              <Select.Option value="modify">修改CSP头</Select.Option>
            </Select>
          </FormItem>
          <Form.Item shouldUpdate noStyle>
            {(values) =>
              values.action === "modify" && (
                <FormItem
                  label={
                    <Space>
                      CSP值
                      <Tooltip content="要添加或修改的CSP指令，例如: script-src 'self' 'unsafe-inline' *">
                        <IconQuestionCircle />
                      </Tooltip>
                    </Space>
                  }
                  field="actionValue"
                  rules={[{ required: true, message: "请输入CSP值" }]}
                >
                  <Input.TextArea
                    placeholder="例如: script-src 'self' 'unsafe-inline' *; connect-src *"
                    rows={3}
                  />
                </FormItem>
              )
            }
          </Form.Item>
          <FormItem label="优先级" field="priority" rules={[{ required: true }]}>
            <InputNumber min={1} max={1000} placeholder="数值越大优先级越高" style={{ width: "100%" }} />
          </FormItem>
          <FormItem label="启用" field="enabled" triggerPropName="checked">
            <Switch defaultChecked />
          </FormItem>
        </Form>
      </Modal>
    </div>
  );
};

export default CSPRuleManage;
