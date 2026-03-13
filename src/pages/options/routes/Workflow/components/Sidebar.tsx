import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Typography, Form, Input, Select, Message, Empty } from "@arco-design/web-react";
import { AutomationScriptClient } from "@App/app/service/service_worker/client";
import { message } from "@App/pages/store/global";
import type { AutomationScript } from "@App/app/repo/automationScript";
import { nodeRegistry } from "../nodes/registry";

const { Title } = Typography;
const FormItem = Form.Item;

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const [scripts, setScripts] = useState<AutomationScript[]>([]);
  const [selectedNodeType] = useState<string | null>(null);
  const [nodeName, setNodeName] = useState("");
  const [scriptKey, setScriptKey] = useState("");
  const [inputMapping, setInputMapping] = useState("{}");
  const [outputMapping, setOutputMapping] = useState("{}");

  const automationClient = new AutomationScriptClient(message);

  useEffect(() => {
    loadScripts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScripts = async () => {
    try {
      const data = await automationClient.getAllScripts();
      setScripts(data);
    } catch (e: any) {
      Message.error(`${t("automation_script_page.load_failed")}: ${e.message}`);
    }
  };

  const handleScriptChange = (value: string) => {
    setScriptKey(value);
  };

  const nodeConfig = selectedNodeType ? nodeRegistry[selectedNodeType] : null;

  if (!selectedNodeType) {
    return (
      <div className="p-4">
        <Empty description={t("workflow_page.select_node_hint")} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <Title heading={6} className="m-0">
            {t(nodeConfig?.label || "workflow_page.node_config")}
          </Title>
        </div>
      </div>
      <div className="p-4">
        <Form layout="vertical" size="small">
          <FormItem label={t("workflow_page.node_name")}>
            <Input
              value={nodeName}
              onChange={setNodeName}
              placeholder={t("workflow_page.node_name_placeholder")}
            />
          </FormItem>
          {selectedNodeType === "script" && (
            <>
              <FormItem label={t("workflow_page.script_key")}>
                <Select
                  value={scriptKey}
                  onChange={handleScriptChange}
                  placeholder={t("workflow_page.select_script")}
                  allowClear
                >
                  {scripts.map((script) => (
                    <Select.Option key={script.key} value={script.key}>
                      {script.name} ({script.key})
                    </Select.Option>
                  ))}
                </Select>
              </FormItem>
              <FormItem label={t("workflow_page.input_mapping")}>
                <Input.TextArea
                  value={inputMapping}
                  onChange={setInputMapping}
                  placeholder='{"param1": "variables.path"}'
                  autoSize={{ minRows: 3, maxRows: 6 }}
                />
              </FormItem>
              <FormItem label={t("workflow_page.output_mapping")}>
                <Input.TextArea
                  value={outputMapping}
                  onChange={setOutputMapping}
                  placeholder='{"result": "variables.output"}'
                  autoSize={{ minRows: 3, maxRows: 6 }}
                />
              </FormItem>
            </>
          )}
        </Form>
      </div>
    </div>
  );
};

export default Sidebar;
