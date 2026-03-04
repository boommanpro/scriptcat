import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Button,
  Card,
  Form,
  Input,
  Switch,
  Message,
  Space,
  Typography,
  Tag,
  Table,
  Select,
  Tooltip,
  InputNumber,
  Collapse,
} from "@arco-design/web-react";
import { IconSave, IconLeft, IconPlayArrow, IconRefresh, IconCopy } from "@arco-design/web-react/icon";
import type { AutomationScript, AutomationTestLog } from "@App/app/repo/automationScript";
import { formatUnixTime } from "@App/pkg/utils/day_format";
import { AutomationScriptClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";
import CodeEditor from "@App/pages/components/CodeEditor";
import { v4 as uuidv4 } from "uuid";
import type { editor } from "monaco-editor";
import "@App/pages/options/routes/script/index.css";
import { defaultConfig as automationEslintConfig } from "@Packages/eslint/automation-linter-config";

const FormItem = Form.Item;
const { Title, Text } = Typography;
const Option = Select.Option;
const CollapseItem = Collapse.Item;

const ScriptEditorComponent: React.FC<{
  id: string;
  code: string;
  onChange: (code: string) => void;
}> = ({ id, code, onChange }) => {
  const [node, setNode] = useState<{ editor?: editor.IStandaloneCodeEditor }>();
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const ref = useCallback<(node: { editor?: editor.IStandaloneCodeEditor } | null) => void>(
    (inlineNode) => {
      if (inlineNode && inlineNode.editor && !node) {
        setNode(inlineNode);
      }
    },
    [node]
  );

  useEffect(() => {
    if (!node || !node.editor) {
      return;
    }
    const editorInstance = node.editor;
    const handler = editorInstance.onKeyUp(() => {
      const currentValue = editorInstance.getValue() || "";
      onChangeRef.current(currentValue);
    });
    return () => {
      handler.dispose();
    };
  }, [node?.editor]);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <CodeEditor
        key={id}
        id={id}
        ref={ref}
        code={code}
        diffCode=""
        editable
        className="script-code-editor"
        eslintConfig={automationEslintConfig}
      />
    </div>
  );
};

const JsonViewer: React.FC<{ data: string; title: string }> = ({ data, title }) => {
  if (!data) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(data);
  } catch {
    return (
      <div className="text-xs">
        <Text bold className="block mb-1">{title}</Text>
        <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40 text-xs whitespace-pre-wrap break-all">
          {data}
        </pre>
      </div>
    );
  }

  return (
    <div className="text-xs">
      <Text bold className="block mb-1">{title}</Text>
      <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40 text-xs whitespace-pre-wrap break-all">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    </div>
  );
};

const AutomationScriptEditor: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scriptCode, setScriptCode] = useState("");
  const [editorId, setEditorId] = useState("");
  const [editingScript, setEditingScript] = useState<AutomationScript | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);

  const [testInput, setTestInput] = useState("{}");
  const [testRunning, setTestRunning] = useState(false);
  const [testLogs, setTestLogs] = useState<AutomationTestLog[]>([]);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<number | undefined>();

  const automationClient = new AutomationScriptClient(message);
  const scriptId = params.id;

  useEffect(() => {
    const newEditorId = `automation-editor-${uuidv4()}`;
    setEditorId(newEditorId);

    const locationState = location.state as { copyFrom?: AutomationScript } | null;
    if (locationState?.copyFrom) {
      const copyScript = locationState.copyFrom;
      setIsCopyMode(true);
      setEditingScript(null);
      const newName = `${copyScript.name} (副本)`;
      const newKey = `${copyScript.key}_copy_${Date.now()}`;
      form.setFieldsValue({
        ...copyScript,
        name: newName,
        key: newKey,
        enabled: false,
        waitForResponse: copyScript.waitForResponse ?? false,
        responseTimeout: copyScript.responseTimeout ?? 30000,
      });
      setScriptCode(copyScript.script);
      const newerEditorId = `automation-editor-${uuidv4()}`;
      setEditorId(newerEditorId);
      navigate(location.pathname, { replace: true, state: null });
    } else if (scriptId) {
      loadScript(scriptId);
    } else {
      const defaultCode = `// 输入参数通过 input 变量获取
// input.testTaskId 为当前测试任务ID

// 方式1：直接 return 返回结果（推荐）
// return { success: true, data: input };

// 方式2：通过 postMessage 返回结果（用于异步场景）
// 需要在脚本设置中开启"等待返回值"
// window.postMessage({
//   testTaskId: input.testTaskId,
//   result: { success: true, data: input }
// }, '*');
// 注意：使用 postMessage 时不要 return 任何值

// 示例：
console.log('Input:', input);
return { success: true, received: input };
`;
      setScriptCode(defaultCode);
      form.setFieldsValue({
        enabled: true,
        waitForResponse: false,
        responseTimeout: 30000,
        script: defaultCode,
      });
    }

    loadTabs();
  }, [scriptId]);

  const loadTabs = async () => {
    try {
      const tabList = await automationClient.getActiveTabs();
      setTabs(tabList);
    } catch (e) {
      console.error("Failed to load tabs:", e);
    }
  };

  const loadScript = async (id: string) => {
    setLoading(true);
    try {
      const scripts = await automationClient.getAllScripts();
      const script = scripts.find((s) => s.id === id);
      if (script) {
        setEditingScript(script);
        form.setFieldsValue({
          ...script,
          waitForResponse: script.waitForResponse ?? false,
          responseTimeout: script.responseTimeout ?? 30000,
        });
        setScriptCode(script.script);
        const newEditorId = `automation-editor-${uuidv4()}`;
        setEditorId(newEditorId);
        const logs = await automationClient.getTestLogs(script.key);
        setTestLogs(logs);
      } else {
        Message.error("脚本不存在");
        navigate("/automation-script");
      }
    } catch (e: any) {
      Message.error(`加载脚本失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScriptChange = (code: string) => {
    setScriptCode(code);
    form.setFieldValue("script", code);
  };

  const handleSave = async () => {
    try {
      await form.validate();

      const formValues = form.getFieldsValue();
      const scriptValue = scriptCode || formValues.script || "";

      if (!scriptValue || scriptValue.trim() === "") {
        Message.error("请输入执行脚本");
        return;
      }

      const values = {
        ...formValues,
        script: scriptValue,
        waitForResponse: formValues.waitForResponse ?? false,
        responseTimeout: formValues.responseTimeout ?? 30000,
      };

      setSaving(true);
      if (editingScript) {
        await automationClient.updateScript(editingScript.id, values);
        Message.success("更新成功");
      } else {
        const result = await automationClient.createScript(values as any);
        Message.success("创建成功");
        navigate(`/automation-script/editor/${result.id}`);
      }
    } catch (e: any) {
      if (e && e.errors) {
        const errorMessages = Object.values(e.errors).flat().join(", ");
        Message.error(`保存失败: ${errorMessages}`);
      } else {
        Message.error(`保存失败: ${e.message || e}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate("/automation-script");
  };

  const handleOpenTargetPage = async () => {
    if (!editingScript) {
      Message.warning("请先保存脚本");
      return;
    }
    try {
      const tabId = await automationClient.openTargetPage(editingScript.key);
      Message.success("已打开目标页面");
      loadTabs();
      setSelectedTabId(tabId);
    } catch (e: any) {
      Message.error(`打开页面失败: ${e.message}`);
    }
  };

  const handleRunTest = async () => {
    if (!editingScript) {
      Message.warning("请先保存脚本后再进行测试");
      return;
    }

    if (!scriptCode || scriptCode.trim() === "") {
      Message.warning("请输入脚本代码");
      return;
    }

    setTestRunning(true);
    try {
      const log = await automationClient.runTest(
        editingScript.key,
        testInput,
        selectedTabId,
        scriptCode
      );
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

  const handleRerunLog = (log: AutomationTestLog) => {
    setTestInput(log.inputJson);
    if (log.scriptContent) {
      setScriptCode(log.scriptContent);
      const newEditorId = `automation-editor-${uuidv4()}`;
      setEditorId(newEditorId);
    }
  };

  const logColumns = [
    {
      title: "状态",
      dataIndex: "status",
      width: 60,
      render: (status: string) => (
        <Tag color={status === "success" ? "green" : status === "error" ? "red" : "blue"} size="small">
          {status === "success" ? "成功" : status === "error" ? "失败" : "运行"}
        </Tag>
      ),
    },
    {
      title: "任务ID",
      dataIndex: "testTaskId",
      width: 100,
      render: (testTaskId: string) =>
        testTaskId ? (
          <Tooltip content={testTaskId}>
            <span className="text-xs font-mono">{testTaskId.slice(0, 8)}...</span>
          </Tooltip>
        ) : (
          "-"
        ),
    },
    {
      title: "时间",
      dataIndex: "createtime",
      width: 80,
      render: (time: number) => <span className="text-xs">{formatUnixTime(time / 1000)}</span>,
    },
    {
      title: "耗时",
      dataIndex: "duration",
      width: 60,
      render: (duration: number) => <span className="text-xs">{duration || "-"}ms</span>,
    },
    {
      title: "操作",
      width: 50,
      render: (_: any, record: AutomationTestLog) => (
        <Button type="text" size="mini" onClick={() => handleRerunLog(record)}>
          重测
        </Button>
      ),
    },
  ];

  const expandedRowRender = (record: AutomationTestLog) => {
    return (
      <div className="p-2 bg-gray-50 space-y-2">
        <JsonViewer data={record.inputJson} title="输入参数" />
        {record.outputJson && <JsonViewer data={record.outputJson} title="返回结果" />}
        {record.error && (
          <div className="text-xs">
            <Text bold className="block mb-1 text-red-500">错误信息</Text>
            <pre className="bg-red-50 p-2 rounded overflow-auto max-h-40 text-xs text-red-600 whitespace-pre-wrap break-all">
              {record.error}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
        <Space>
          <Button icon={<IconLeft />} onClick={handleBack}>
            返回
          </Button>
          <Title heading={5} className="m-0">
            {isCopyMode ? "复制脚本" : editingScript ? "编辑脚本" : "新建脚本"}
          </Title>
        </Space>
        <Space>
          {editingScript && !isCopyMode && (
            <Button
              icon={<IconCopy />}
              onClick={() => {
                setIsCopyMode(true);
                const newName = `${editingScript.name} (副本)`;
                const newKey = `${editingScript.key}_copy_${Date.now()}`;
                form.setFieldsValue({
                  name: newName,
                  key: newKey,
                  enabled: false,
                });
                setEditingScript(null);
              }}
            >
              复制
            </Button>
          )}
          <Button type="primary" icon={<IconSave />} onClick={handleSave} loading={saving}>
            保存
          </Button>
        </Space>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <Card className="w-72 flex-shrink-0 m-2 overflow-auto" title="基本信息">
          <Form form={form} layout="vertical" disabled={loading} size="small">
            <FormItem label="脚本名称" field="name" rules={[{ required: true, message: "请输入脚本名称" }]}>
              <Input placeholder="请输入脚本名称" />
            </FormItem>
            <FormItem
              label="标识Key"
              field="key"
              rules={[
                { required: true, message: "请输入标识Key" },
                { match: /^[a-zA-Z0-9_-]+$/, message: "只能包含字母、数字、下划线和连字符" },
              ]}
            >
              <Input placeholder="唯一标识" disabled={!!editingScript} />
            </FormItem>
            <FormItem label="描述" field="description">
              <Input.TextArea placeholder="请输入脚本描述" rows={2} />
            </FormItem>
            <FormItem label="目标网址" field="targetUrl">
              <Input placeholder="目标页面URL，可选" />
            </FormItem>
            <FormItem
              label="等待返回值"
              field="waitForResponse"
              triggerPropName="checked"
              extra="开启后，脚本执行将等待页面通过 postMessage 返回结果"
            >
              <Switch />
            </FormItem>
            <FormItem
              label="超时时间 (ms)"
              field="responseTimeout"
              extra="等待 postMessage 响应的最大时间"
            >
              <InputNumber
                min={1000}
                max={120000}
                step={1000}
                style={{ width: "100%" }}
              />
            </FormItem>
            <FormItem label="启用" field="enabled" triggerPropName="checked">
              <Switch />
            </FormItem>
          </Form>
        </Card>

        <Card
          className="flex-1 m-2 ml-0 flex flex-col overflow-hidden"
          title="执行脚本"
          style={{ display: "flex", flexDirection: "column" }}
          bodyStyle={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: 0,
            minHeight: 0,
          }}
        >
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {editorId && <ScriptEditorComponent id={editorId} code={scriptCode} onChange={handleScriptChange} />}
          </div>
        </Card>

        <Card
          className="w-80 flex-shrink-0 m-2 ml-0 flex flex-col overflow-hidden"
          title="测试"
          bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "8px" }}
        >
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <Text bold>目标标签页</Text>
                <Button size="mini" icon={<IconRefresh />} onClick={loadTabs}>
                  刷新
                </Button>
              </div>
              <Select
                placeholder="选择标签页或使用目标网址"
                value={selectedTabId}
                onChange={(val) => setSelectedTabId(val)}
                style={{ width: "100%" }}
                size="small"
                allowClear
              >
                {tabs.map((tab) => (
                  <Option key={tab.id} value={tab.id!}>
                    <Tooltip content={tab.url}>
                      <span className="text-xs truncate block">{tab.title || tab.url}</span>
                    </Tooltip>
                  </Option>
                ))}
              </Select>
            </div>

            <div className="mb-2">
              <Text bold className="block mb-1">
                输入参数 (JSON)
              </Text>
              <Input.TextArea
                value={testInput}
                onChange={setTestInput}
                placeholder='{"key": "value"}'
                rows={4}
                style={{ fontSize: 12 }}
              />
            </div>

            <Space className="mb-2">
              <Button
                type="primary"
                icon={<IconPlayArrow />}
                onClick={handleRunTest}
                loading={testRunning}
                disabled={!editingScript}
                size="small"
              >
                {editingScript ? "执行测试" : "请先保存"}
              </Button>
              {editingScript?.targetUrl && (
                <Button icon={<IconPlayArrow />} onClick={handleOpenTargetPage} size="small">
                  打开目标页
                </Button>
              )}
            </Space>

            {editingScript && scriptCode !== editingScript.script && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                当前测试将使用编辑框中的未保存内容
              </div>
            )}

            <div className="mt-2 flex-1 overflow-hidden flex flex-col">
              <Text bold className="block mb-2">
                测试历史（点击行展开查看详情）
              </Text>
              <div className="flex-1 overflow-auto">
                <Table
                  columns={logColumns}
                  data={testLogs}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ y: 300 }}
                  expandedRowRender={expandedRowRender}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AutomationScriptEditor;
