import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Message,
  Typography,
  Spin,
  Modal,
  Form,
  Input,
  Button,
  Drawer,
  Tag,
  Empty,
  Descriptions,
} from "@arco-design/web-react";
import { IconLeft } from "@arco-design/web-react/icon";
import type { Workflow, WorkflowExecutionLog } from "@App/app/repo/workflow";
import { WorkflowClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";
import { useTranslation } from "react-i18next";
import WorkflowEditor from "./components/WorkflowEditor";

const { Title, Text } = Typography;
const FormItem = Form.Item;

const WorkflowEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState<WorkflowExecutionLog | null>(null);
  const [runModalVisible, setRunModalVisible] = useState(false);
  const [runInput, setRunInput] = useState("{}");
  const [executionDrawerVisible, setExecutionDrawerVisible] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<WorkflowExecutionLog[]>([]);

  const workflowClient = new WorkflowClient(message);

  useEffect(() => {
    if (id) {
      loadWorkflow(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadWorkflow = async (workflowId: string) => {
    setLoading(true);
    try {
      const workflows = await workflowClient.getAllWorkflows();
      const wf = workflows.find((w) => w.id === workflowId);
      if (wf) {
        setWorkflow(wf);
        loadExecutionLogs(wf.id);
      } else {
        Message.error(t("workflow_page.not_found"));
        navigate("/workflow");
      }
    } catch (e: any) {
      Message.error(`${t("workflow_page.load_failed")}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionLogs = async (workflowId: string) => {
    try {
      const logs = await workflowClient.getExecutionLogs(workflowId, 20);
      setExecutionLogs(logs);
    } catch (e: any) {
      console.error("Failed to load execution logs:", e);
    }
  };

  const handleSave = async (updatedWorkflow: Workflow) => {
    try {
      await workflowClient.updateWorkflow(updatedWorkflow.id, updatedWorkflow);
      setWorkflow(updatedWorkflow);
    } catch (e: any) {
      Message.error(`${t("save_failed")}: ${e.message}`);
    }
  };

  const handleRun = () => {
    setRunModalVisible(true);
    setRunInput("{}");
  };

  const handleExecuteWorkflow = async () => {
    if (!workflow) return;

    setIsRunning(true);
    setRunModalVisible(false);

    try {
      const log = await workflowClient.runWorkflow(workflow.id, runInput);
      setExecutionLog(log);
      loadExecutionLogs(workflow.id);

      if (log.status === "success") {
        Message.success(t("workflow_page.execution_success"));
      } else if (log.status === "error") {
        Message.error(`${t("workflow_page.execution_failed")}: ${log.error}`);
      }
    } catch (e: any) {
      Message.error(`${t("workflow_page.execution_failed")}: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    if (!executionLog) return;

    try {
      await workflowClient.stopWorkflowExecution(executionLog.id);
      Message.success(t("workflow_page.execution_stopped"));
      setIsRunning(false);
    } catch (e: any) {
      Message.error(`${t("workflow_page.stop_failed")}: ${e.message}`);
    }
  };

  const handleBack = () => {
    navigate("/workflow");
  };

  const getStatusTag = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: "gray",
      running: "blue",
      success: "green",
      error: "red",
      cancelled: "orange",
    };
    return <Tag color={statusColors[status] || "gray"}>{t(`workflow_page.status_${status}`)}</Tag>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size={32} />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <Empty description={t("workflow_page.not_found")} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 p-2 border-b border-gray-200 bg-white">
        <Button icon={<IconLeft />} onClick={handleBack}>
          {t("back")}
        </Button>
        <Title heading={5} className="m-0">
          {workflow.name}
        </Title>
        <Text type="secondary" className="text-sm">
          {workflow.description}
        </Text>
        <div className="flex-1" />
        <Button type="outline" onClick={() => setExecutionDrawerVisible(true)}>
          {t("workflow_page.execution_history")}
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <WorkflowEditor
          workflow={workflow}
          onSave={handleSave}
          onRun={handleRun}
          onStop={handleStop}
          isRunning={isRunning}
        />
      </div>

      <Modal
        title={t("workflow_page.run_workflow")}
        visible={runModalVisible}
        onOk={handleExecuteWorkflow}
        onCancel={() => setRunModalVisible(false)}
        okText={t("workflow_page.run")}
        cancelText={t("close")}
      >
        <Form layout="vertical">
          <FormItem label={t("workflow_page.input_parameters")}>
            <Input.TextArea
              value={runInput}
              onChange={setRunInput}
              placeholder='{"key": "value"}'
              autoSize={{ minRows: 5, maxRows: 15 }}
            />
          </FormItem>
        </Form>
      </Modal>

      <Drawer
        title={t("workflow_page.execution_history")}
        visible={executionDrawerVisible}
        onOk={() => setExecutionDrawerVisible(false)}
        onCancel={() => setExecutionDrawerVisible(false)}
        width={600}
        footer={null}
      >
        <div className="space-y-4">
          {executionLogs.length === 0 ? (
            <Empty description={t("workflow_page.no_execution_history")} />
          ) : (
            executionLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  setExecutionLog(log);
                  setExecutionDrawerVisible(false);
                }}
              >
                <div className="flex justify-between items-center mb-2">
                  {getStatusTag(log.status)}
                  <Text type="secondary" className="text-xs">
                    {new Date(log.createtime).toLocaleString()}
                  </Text>
                </div>
                {log.duration && (
                  <Text type="secondary" className="text-xs">
                    {t("workflow_page.duration")}: {log.duration}ms
                  </Text>
                )}
                {log.error && (
                  <Text type="error" className="text-xs block mt-1">
                    {log.error}
                  </Text>
                )}
              </div>
            ))
          )}
        </div>
      </Drawer>

      {executionLog && (
        <Drawer
          title={t("workflow_page.execution_detail")}
          visible={!!executionLog}
          onOk={() => setExecutionLog(null)}
          onCancel={() => setExecutionLog(null)}
          width={600}
          footer={null}
        >
          <Descriptions
            column={1}
            border
            data={[
              { label: t("workflow_page.status"), value: getStatusTag(executionLog.status) },
              { label: t("workflow_page.start_time"), value: new Date(executionLog.createtime).toLocaleString() },
              ...(executionLog.duration
                ? [{ label: t("workflow_page.duration"), value: `${executionLog.duration}ms` }]
                : []),
              ...(executionLog.error
                ? [{ label: t("workflow_page.error"), value: <Text type="error">{executionLog.error}</Text> }]
                : []),
              {
                label: t("workflow_page.input_parameters"),
                value: (
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(JSON.parse(executionLog.inputJson || "{}"), null, 2)}
                  </pre>
                ),
              },
              ...(executionLog.outputJson
                ? [
                    {
                      label: t("workflow_page.output"),
                      value: (
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                          {JSON.stringify(JSON.parse(executionLog.outputJson), null, 2)}
                        </pre>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Drawer>
      )}
    </div>
  );
};

export default WorkflowEditorPage;
