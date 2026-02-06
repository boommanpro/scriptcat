import { useState } from "react";
import { Modal, Space, Input, Switch, Button, Message as ArcoMessage } from "@arco-design/web-react";
import type { AIConfig } from "@App/pkg/ai";

interface AIConfigEditorModalProps {
  visible: boolean;
  config: AIConfig | null;
  onSave: () => void;
  onCancel: () => void;
  onChange: (config: AIConfig) => void;
  loading: boolean;
}

export const AIConfigEditorModal = ({
  visible,
  config,
  onSave,
  onCancel,
  onChange,
  loading: _loading,
}: AIConfigEditorModalProps) => {
  const [testLoading, setTestLoading] = useState(false);

  const handleTestConnection = async () => {
    if (!config) return;

    setTestLoading(true);
    try {
      const response = await fetch(`${config.apiEndpoint}/models`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
        },
      });

      if (response.ok) {
        const data = await response.json();
        ArcoMessage.success("连接成功！API可用");
        console.log("Available models:", data);
      } else {
        ArcoMessage.error(`连接失败: ${response.status}`);
      }
    } catch (error) {
      ArcoMessage.error("连接失败，请检查配置");
      console.error("Connection test failed:", error);
    } finally {
      setTestLoading(false);
    }
  };

  if (!config) return null;

  return (
    <Modal
      title={config.id ? "编辑AI配置" : "新增AI配置"}
      visible={visible}
      onOk={onSave}
      onCancel={onCancel}
      okText="保存"
      cancelText="取消"
      width={1000}
    >
      <Space direction="vertical" size={20} className="w-full">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-medium mb-1">配置名称</span>
            <Input
              placeholder="例如: GPT-4 通用配置"
              value={config.name}
              onChange={(value) => onChange({ ...config, name: value })}
            />
          </div>
          <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">用于识别此配置的名称</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-medium mb-1">API端点</span>
            <Input
              placeholder="例如: http://localhost:1234/v1"
              value={config.apiEndpoint}
              onChange={(value) => onChange({ ...config, apiEndpoint: value })}
            />
          </div>
          <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">OpenAI兼容的API端点地址</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-medium mb-1">API密钥</span>
            <Input.Password
              placeholder="可选，如果API需要认证"
              value={config.apiKey}
              onChange={(value) => onChange({ ...config, apiKey: value })}
            />
          </div>
          <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">如果API需要认证，请提供密钥</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-medium mb-1">模型名称</span>
            <Input
              placeholder="例如: gpt-3.5-turbo"
              value={config.model}
              onChange={(value) => onChange({ ...config, model: value })}
            />
          </div>
          <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">要使用的AI模型名称</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-medium mb-1">系统提示词</span>
            <Input.TextArea
              placeholder="系统提示词，定义AI的行为和角色"
              autoSize={{ minRows: 6, maxRows: 12 }}
              value={config.systemPrompt}
              onChange={(value) => onChange({ ...config, systemPrompt: value })}
            />
          </div>
          <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">定义AI助手的行为和角色</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-medium mb-1">温度 (Temperature)</span>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={config.temperature.toString()}
              onChange={(value) => {
                const num = parseFloat(value);
                if (!isNaN(num) && num >= 0 && num <= 2) {
                  onChange({ ...config, temperature: num });
                }
              }}
            />
          </div>
          <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">控制输出的随机性 (0-2)</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-medium mb-1">最大令牌数 (Max Tokens)</span>
            <Input
              type="number"
              placeholder="-1表示无限制"
              value={config.maxTokens.toString()}
              onChange={(value) => {
                const num = parseInt(value, 10);
                if (!isNaN(num)) {
                  onChange({ ...config, maxTokens: num });
                }
              }}
            />
          </div>
          <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">-1表示无限制</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-medium mb-1">启用知识库</span>
            <Switch
              checked={config.enableKnowledgeBase}
              onChange={(checked) => onChange({ ...config, enableKnowledgeBase: checked })}
            />
          </div>
          <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">启用后，AI将使用ScriptCat知识库</span>
        </div>

        <Space direction="horizontal" className="w-full pt-4" size={12}>
          <Button type="primary" onClick={onSave}>
            保存配置
          </Button>
          <Button onClick={handleTestConnection} loading={testLoading}>
            测试连接
          </Button>
        </Space>
      </Space>
    </Modal>
  );
};
