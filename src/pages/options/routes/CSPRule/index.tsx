import { useEffect, useState, useCallback } from "react";
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
  Tabs,
  Drawer,
} from "@arco-design/web-react";
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconQuestionCircle,
  IconBook,
  IconExperiment,
} from "@arco-design/web-react/icon";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { CSPRule, CSPRuleAction } from "@App/app/repo/cspRule";
import { formatUnixTime } from "@App/pkg/utils/day_format";
import { CSPRuleClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";
import { useTranslation } from "react-i18next";
import PatternTester from "./components/PatternTester";
import PatternGuide from "./components/PatternGuide";

const FormItem = Form.Item;
const { Title } = Typography;
const TabPane = Tabs.TabPane;

const CSPRuleManage: React.FC = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<CSPRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<CSPRule | null>(null);
  const [form] = Form.useForm();
  const [guideDrawerVisible, setGuideDrawerVisible] = useState(false);
  const [testerDrawerVisible, setTesterDrawerVisible] = useState(false);

  const cspRuleClient = new CSPRuleClient(message);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cspRuleClient.getAllRules();
      setRules(data);
    } catch (e: any) {
      Message.error(`${t("csp_rule_page.load_failed")}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

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
      Message.success(t("csp_rule_page.delete_success"));
      loadRules();
    } catch (e: any) {
      Message.error(`${t("csp_rule_page.delete_failed")}: ${e.message}`);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await cspRuleClient.toggleRule(id, enabled);
      loadRules();
    } catch (e: any) {
      Message.error(`${t("csp_rule_page.operation_failed")}: ${e.message}`);
    }
  };

  const handleSubmit = async () => {
    try {
      await form.validate();
      const values = form.getFieldsValue() as Omit<CSPRule, "id" | "createtime" | "updatetime">;

      if (editingRule) {
        await cspRuleClient.updateRule(editingRule.id, values);
        Message.success(t("csp_rule_page.update_success"));
      } else {
        await cspRuleClient.createRule(values);
        Message.success(t("csp_rule_page.create_success"));
      }
      setModalVisible(false);
      loadRules();
    } catch (e: any) {
      Message.error(`${t("csp_rule_page.operation_failed")}: ${e.message}`);
    }
  };

  const columns: ColumnProps<CSPRule>[] = [
    {
      title: t("enable"),
      dataIndex: "enabled",
      width: 80,
      render: (enabled, record) => (
        <Switch checked={enabled} onChange={(checked) => handleToggle(record.id, checked)} />
      ),
    },
    {
      title: t("csp_rule_page.rule_name"),
      dataIndex: "name",
      width: 150,
    },
    {
      title: t("description"),
      dataIndex: "description",
      width: 200,
      render: (text) => <span className="text-gray-500">{text || "-"}</span>,
    },
    {
      title: (
        <Space>
          {t("csp_rule_page.match_path")}
          <Tooltip content={t("csp_rule_page.match_path_tooltip")}>
            <IconQuestionCircle />
          </Tooltip>
        </Space>
      ),
      dataIndex: "path",
      width: 250,
      render: (text) => <code className="text-xs bg-gray-100 px-1 rounded">{text}</code>,
    },
    {
      title: t("csp_rule_page.action_type"),
      dataIndex: "action",
      width: 100,
      render: (action: CSPRuleAction) => (
        <Tag color={action === "remove" ? "red" : "blue"}>
          {action === "remove" ? t("csp_rule_page.remove_csp") : t("csp_rule_page.modify_csp")}
        </Tag>
      ),
    },
    {
      title: t("csp_rule_page.modify_value"),
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
      title: t("csp_rule_page.priority"),
      dataIndex: "priority",
      width: 80,
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: t("csp_rule_page.create_time"),
      dataIndex: "createtime",
      width: 150,
      render: (time) => formatUnixTime(time),
    },
    {
      title: t("csp_rule_page.update_time"),
      dataIndex: "updatetime",
      width: 150,
      render: (time) => formatUnixTime(time),
    },
    {
      title: t("action"),
      width: 150,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            {t("edit")}
          </Button>
          <Popconfirm
            title={t("csp_rule_page.confirm_delete")}
            onOk={() => handleDelete(record.id)}
            okText={t("confirm")}
            cancelText={t("close")}
          >
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
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
        <Tabs defaultActiveTab="rules">
          <TabPane
            key="rules"
            title={
              <Space>
                <span>{t("csp_rule_page.title")}</span>
              </Space>
            }
          >
            <div className="flex justify-between items-center mb-4">
              <Space>
                <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
                  {t("csp_rule_page.add_rule")}
                </Button>
              </Space>
              <Space>
                <Button icon={<IconExperiment />} onClick={() => setTesterDrawerVisible(true)}>
                  {t("csp_rule_page.pattern_tester.title")}
                </Button>
                <Button icon={<IconBook />} onClick={() => setGuideDrawerVisible(true)}>
                  {t("csp_rule_page.guide.title")}
                </Button>
              </Space>
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
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={editingRule ? t("csp_rule_page.edit_rule") : t("csp_rule_page.add_rule")}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        autoFocus={false}
        focusLock={true}
        style={{ width: 600 }}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label={t("csp_rule_page.rule_name")}
            field="name"
            rules={[{ required: true, message: t("csp_rule_page.enter_rule_name") }]}
          >
            <Input placeholder={t("csp_rule_page.enter_rule_name")} />
          </FormItem>
          <FormItem label={t("description")} field="description">
            <Input.TextArea placeholder={t("csp_rule_page.enter_rule_description")} rows={2} />
          </FormItem>
          <FormItem
            label={
              <Space>
                {t("csp_rule_page.match_path")}
                <Tooltip content={t("csp_rule_page.match_path_detailed_tooltip")}>
                  <IconQuestionCircle className="cursor-help" />
                </Tooltip>
                <Button type="text" size="small" icon={<IconBook />} onClick={() => setGuideDrawerVisible(true)} />
              </Space>
            }
            field="path"
            rules={[{ required: true, message: t("csp_rule_page.enter_path") }]}
            extra={<div className="text-xs text-gray-500 mt-1">{t("csp_rule_page.match_path_help")}</div>}
          >
            <Input placeholder="*://example.com/* or /https?:\/\/example\.com\/.*/i" />
          </FormItem>
          <FormItem label={t("csp_rule_page.action_type")} field="action" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="remove">{t("csp_rule_page.remove_csp_header")}</Select.Option>
              <Select.Option value="modify">{t("csp_rule_page.modify_csp_header")}</Select.Option>
            </Select>
          </FormItem>
          <Form.Item shouldUpdate noStyle>
            {(values) =>
              values.action === "modify" && (
                <FormItem
                  label={
                    <Space>
                      {t("csp_rule_page.csp_value")}
                      <Tooltip content={t("csp_rule_page.csp_value_tooltip")}>
                        <IconQuestionCircle />
                      </Tooltip>
                    </Space>
                  }
                  field="actionValue"
                  rules={[{ required: true, message: t("csp_rule_page.enter_csp_value") }]}
                >
                  <Input.TextArea placeholder="script-src 'self' 'unsafe-inline' *; connect-src *" rows={3} />
                </FormItem>
              )
            }
          </Form.Item>
          <FormItem label={t("csp_rule_page.priority")} field="priority" rules={[{ required: true }]}>
            <InputNumber
              min={1}
              max={1000}
              placeholder={t("csp_rule_page.priority_tooltip")}
              style={{ width: "100%" }}
            />
          </FormItem>
          <FormItem label={t("enable")} field="enabled" triggerPropName="checked">
            <Switch defaultChecked />
          </FormItem>
        </Form>
      </Modal>

      <Drawer
        title={
          <Space>
            <IconBook />
            {t("csp_rule_page.guide.title")}
          </Space>
        }
        visible={guideDrawerVisible}
        onCancel={() => setGuideDrawerVisible(false)}
        width={720}
        footer={null}
      >
        <PatternGuide
          onOpenTester={() => {
            setGuideDrawerVisible(false);
            setTesterDrawerVisible(true);
          }}
        />
      </Drawer>

      <Drawer
        title={
          <Space>
            <IconExperiment />
            {t("csp_rule_page.pattern_tester.title")}
          </Space>
        }
        visible={testerDrawerVisible}
        onCancel={() => setTesterDrawerVisible(false)}
        width={600}
        footer={null}
      >
        <PatternTester />
      </Drawer>
    </div>
  );
};

export default CSPRuleManage;
