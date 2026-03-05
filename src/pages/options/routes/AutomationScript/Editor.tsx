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
import { useTranslation } from "react-i18next";

const FormItem = Form.Item;
const { Title, Text } = Typography;
const Option = Select.Option;

const ScriptEditorComponent: React.FC<{
  id: string;
  code: string;
  onChange: (code: string) => void;
}> = ({ id, code, onChange }) => {
  const [node, setNode] = useState<{ editor?: editor.IStandaloneCodeEditor }>();
  const onChangeRef = useRef(onChange);
  const isInitializedRef = useRef(false);

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

    const handler = editorInstance.onDidChangeModelContent(() => {
      const currentValue = editorInstance.getValue() || "";
      onChangeRef.current(currentValue);
    });

    isInitializedRef.current = true;

    return () => {
      handler.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <Text bold className="block mb-1">
          {title}
        </Text>
        <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40 text-xs whitespace-pre-wrap break-all">
          {data}
        </pre>
      </div>
    );
  }

  return (
    <div className="text-xs">
      <Text bold className="block mb-1">
        {title}
      </Text>
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
  const { t } = useTranslation();
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
      const newName = `${copyScript.name} (${t("automation_script_page.copy_suffix")})`;
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
        inputParams: "",
      });
    }

    loadTabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        Message.error(t("automation_script_page.script_not_found"));
        navigate("/automation-script");
      }
    } catch (e: any) {
      Message.error(`${t("automation_script_page.load_failed")}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScriptChange = (code: string) => {
    setScriptCode(code);
    form.setFieldValue("script", code);
  };

  const handleSave = async () => {
    console.log("=== [Editor] Save Script ===");
    console.log(`[${new Date().toISOString()}] Saving script`);
    console.log("Is Copy Mode:", isCopyMode);
    console.log("Editing Script ID:", editingScript?.id);

    try {
      await form.validate();

      const formValues = form.getFieldsValue();
      const scriptValue = scriptCode || formValues.script || "";

      console.log("--- Form Values ---");
      console.log("Name:", formValues.name);
      console.log("Key:", formValues.key);
      console.log("waitForResponse:", formValues.waitForResponse);
      console.log("responseTimeout:", formValues.responseTimeout);
      console.log("enabled:", formValues.enabled);
      console.log("--- Script Code Length ---");
      console.log(scriptValue.length, "characters");
      console.log("=== End Save Info ===");

      if (!scriptValue || scriptValue.trim() === "") {
        Message.error(t("automation_script_page.enter_script"));
        return;
      }

      const values = {
        ...formValues,
        script: scriptValue,
        waitForResponse: formValues.waitForResponse ?? false,
        responseTimeout: formValues.responseTimeout ?? 30000,
      };

      setSaving(true);
      if (editingScript && !isCopyMode) {
        const updated = await automationClient.updateScript(editingScript.id, values);
        Message.success(t("automation_script_page.update_success"));
        if (updated) {
          setEditingScript(updated);
          console.log("Script updated, editingScript state refreshed");
        }
      } else {
        const result = await automationClient.createScript(values as any);
        Message.success(t("automation_script_page.create_success"));
        setEditingScript(result);
        setIsCopyMode(false);
        console.log("Script created, new ID:", result.id);
        navigate(`/automation-script/editor/${result.id}`);
      }
    } catch (e: any) {
      if (e && e.errors) {
        const errorMessages = Object.values(e.errors).flat().join(", ");
        Message.error(`${t("automation_script_page.save_failed")}: ${errorMessages}`);
      } else {
        Message.error(`${t("automation_script_page.save_failed")}: ${e.message || e}`);
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
      Message.warning(t("automation_script_page.save_script_first"));
      return;
    }
    try {
      const tabId = await automationClient.openTargetPage(editingScript.key);
      Message.success(t("automation_script_page.target_page_opened"));
      loadTabs();
      setSelectedTabId(tabId);
    } catch (e: any) {
      Message.error(`${t("automation_script_page.open_page_failed")}: ${e.message}`);
    }
  };

  const handleRunTest = async () => {
    if (!editingScript) {
      Message.warning(t("automation_script_page.save_before_test"));
      return;
    }

    if (!scriptCode || scriptCode.trim() === "") {
      Message.warning(t("automation_script_page.enter_script_code"));
      return;
    }

    const formValues = form.getFieldsValue();
    const waitForResponse = formValues.waitForResponse ?? false;
    const responseTimeout = formValues.responseTimeout ?? 30000;

    console.log("=== [Editor] Test Execution Request ===");
    console.log(`[${new Date().toISOString()}] Initiating test from editor`);
    console.log("Script Key:", editingScript.key);
    console.log("Script ID:", editingScript.id);
    console.log("--- Form Values ---");
    console.log("Name:", formValues.name);
    console.log("Key:", formValues.key);
    console.log("waitForResponse:", waitForResponse);
    console.log("responseTimeout:", responseTimeout);
    console.log("enabled:", formValues.enabled);
    console.log("--- Script Code (first 500 chars) ---");
    console.log(scriptCode.substring(0, 500));
    console.log("--- Input JSON ---");
    console.log(testInput);
    console.log("Selected Tab ID:", selectedTabId);
    console.log("=== End Test Request ===");

    setTestRunning(true);
    try {
      const log = await automationClient.runTest(
        editingScript.key,
        testInput,
        selectedTabId,
        scriptCode,
        waitForResponse,
        responseTimeout
      );
      setTestLogs([log, ...testLogs]);
      if (log.status === "success") {
        Message.success(t("automation_script_page.test_success"));
      } else {
        Message.error(`${t("automation_script_page.test_failed")}: ${log.error}`);
      }
    } catch (e: any) {
      Message.error(`${t("automation_script_page.test_failed")}: ${e.message}`);
    } finally {
      setTestRunning(false);
    }
  };

  const handleRerunLog = (log: AutomationTestLog) => {
    console.log("=== [Editor] Rerun from History ===");
    console.log(`[${new Date().toISOString()}] Rerunning test from log`);
    console.log("Log ID:", log.id);
    console.log("Test Task ID:", log.testTaskId);
    console.log("Original Status:", log.status);
    console.log("--- Original Input ---");
    console.log(log.inputJson);
    console.log("--- Original Script (first 500 chars) ---");
    if (log.scriptContent) {
      console.log(log.scriptContent.substring(0, 500));
    } else {
      console.log("(no script content saved)");
    }
    console.log("--- Original Configuration ---");
    console.log("waitForResponse:", log.waitForResponse);
    console.log("responseTimeout:", log.responseTimeout);
    console.log("=== End Rerun Info ===");

    setTestInput(log.inputJson);
    if (log.scriptContent) {
      setScriptCode(log.scriptContent);
      const newEditorId = `automation-editor-${uuidv4()}`;
      setEditorId(newEditorId);
    }
    if (log.waitForResponse !== undefined) {
      form.setFieldValue("waitForResponse", log.waitForResponse);
    }
    if (log.responseTimeout !== undefined) {
      form.setFieldValue("responseTimeout", log.responseTimeout);
    }
  };

  const logColumns = [
    {
      title: t("automation_script_page.status"),
      dataIndex: "status",
      width: 60,
      render: (status: string) => (
        <Tag color={status === "success" ? "green" : status === "error" ? "red" : "blue"} size="small">
          {status === "success"
            ? t("automation_script_page.success")
            : status === "error"
              ? t("automation_script_page.failed")
              : t("automation_script_page.running")}
        </Tag>
      ),
    },
    {
      title: t("automation_script_page.task_id"),
      dataIndex: "testTaskId",
      width: 100,
      render: (testTaskId: string) =>
        testTaskId ? (
          <Tooltip content={testTaskId}>
            <span className="text-xs font-mono">{`${testTaskId.slice(0, 8)}...`}</span>
          </Tooltip>
        ) : (
          "-"
        ),
    },
    {
      title: t("automation_script_page.time"),
      dataIndex: "createtime",
      width: 80,
      render: (time: number) => <span className="text-xs">{formatUnixTime(time / 1000)}</span>,
    },
    {
      title: t("automation_script_page.duration"),
      dataIndex: "duration",
      width: 60,
      render: (duration: number) => <span className="text-xs">{`${duration || "-"}ms`}</span>,
    },
    {
      title: t("action"),
      width: 50,
      render: (_: any, record: AutomationTestLog) => (
        <Button type="text" size="mini" onClick={() => handleRerunLog(record)}>
          {t("automation_script_page.rerun")}
        </Button>
      ),
    },
  ];

  const expandedRowRender = (record: AutomationTestLog) => {
    return (
      <div className="p-2 bg-gray-50 space-y-2">
        <JsonViewer data={record.inputJson} title={t("automation_script_page.input_params")} />
        {record.outputJson && <JsonViewer data={record.outputJson} title={t("automation_script_page.return_result")} />}
        {record.error && (
          <div className="text-xs">
            <Text bold className="block mb-1 text-red-500">
              {t("automation_script_page.error_info")}
            </Text>
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
            {t("back")}
          </Button>
          <Title heading={5} className="m-0">
            {isCopyMode
              ? t("automation_script_page.copy_script")
              : editingScript
                ? t("automation_script_page.edit_script")
                : t("automation_script_page.new_script")}
          </Title>
        </Space>
        <Space>
          {editingScript && !isCopyMode && (
            <Button
              icon={<IconCopy />}
              onClick={() => {
                setIsCopyMode(true);
                const newName = `${editingScript.name} (${t("automation_script_page.copy_suffix")})`;
                const newKey = `${editingScript.key}_copy_${Date.now()}`;
                form.setFieldsValue({
                  name: newName,
                  key: newKey,
                  enabled: false,
                });
                setEditingScript(null);
              }}
            >
              {t("automation_script_page.copy")}
            </Button>
          )}
          <Button type="primary" icon={<IconSave />} onClick={handleSave} loading={saving}>
            {t("save")}
          </Button>
        </Space>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <Card className="w-72 flex-shrink-0 m-2 overflow-auto" title={t("automation_script_page.basic_info")}>
          <Form form={form} layout="vertical" disabled={loading} size="small">
            <FormItem
              label={t("automation_script_page.script_name")}
              field="name"
              rules={[{ required: true, message: t("automation_script_page.enter_script_name") }]}
            >
              <Input placeholder={t("automation_script_page.enter_script_name")} />
            </FormItem>
            <FormItem
              label={t("automation_script_page.key_label")}
              field="key"
              rules={[
                { required: true, message: t("automation_script_page.enter_key") },
                { match: /^[a-zA-Z0-9_-]+$/, message: t("automation_script_page.key_rule") },
              ]}
            >
              <Input placeholder={t("automation_script_page.unique_key")} disabled={!!editingScript} />
            </FormItem>
            <FormItem label={t("description")} field="description">
              <Input.TextArea placeholder={t("automation_script_page.enter_description_optional")} rows={2} />
            </FormItem>
            <FormItem
              label={t("automation_script_page.input_params_example")}
              field="inputParams"
              extra={t("automation_script_page.input_params_example_desc")}
            >
              <Input.TextArea placeholder='{"key": "value"}' rows={2} />
            </FormItem>
            <FormItem label={t("automation_script_page.target_url")} field="targetUrl">
              <Input placeholder={t("automation_script_page.target_url_optional")} />
            </FormItem>
            <FormItem
              label={t("automation_script_page.wait_for_response")}
              field="waitForResponse"
              triggerPropName="checked"
              extra={t("automation_script_page.wait_for_response_desc")}
            >
              <Switch />
            </FormItem>
            <FormItem
              label={t("automation_script_page.timeout_ms")}
              field="responseTimeout"
              extra={t("automation_script_page.timeout_desc")}
            >
              <InputNumber min={1000} max={120000} step={1000} style={{ width: "100%" }} />
            </FormItem>
            <FormItem label={t("automation_script_page.enable")} field="enabled" triggerPropName="checked">
              <Switch />
            </FormItem>
          </Form>
        </Card>

        <Card
          className="flex-1 m-2 ml-0 flex flex-col overflow-hidden"
          title={t("automation_script_page.execute_script")}
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
          title={t("automation_script_page.test")}
          bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "8px" }}
        >
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <Text bold>{t("automation_script_page.target_tab")}</Text>
                <Button size="mini" icon={<IconRefresh />} onClick={loadTabs}>
                  {t("automation_script_page.refresh")}
                </Button>
              </div>
              <Select
                placeholder={t("automation_script_page.select_tab_or_url")}
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
                {t("automation_script_page.input_params_json")}
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
                {editingScript ? t("automation_script_page.execute_test") : t("automation_script_page.save_first")}
              </Button>
              {editingScript?.targetUrl && (
                <Button icon={<IconPlayArrow />} onClick={handleOpenTargetPage} size="small">
                  {t("automation_script_page.open_target_page")}
                </Button>
              )}
            </Space>

            {editingScript && scriptCode !== editingScript.script && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                {t("automation_script_page.unsaved_content_warning")}
              </div>
            )}

            <div className="mt-2 flex-1 overflow-hidden flex flex-col">
              <Text bold className="block mb-2">
                {t("automation_script_page.test_history")}
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
