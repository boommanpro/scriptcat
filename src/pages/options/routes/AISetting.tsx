import { Button, Card, Input, Message, Space, Switch } from "@arco-design/web-react";
import React, { useEffect, useState } from "react";

interface AISettings {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enableKnowledgeBase: boolean;
}

const defaultSettings: AISettings = {
  apiEndpoint: "http://localhost:1234/v1",
  apiKey: "",
  model: "qwen/qwen3-4b-2507",
  systemPrompt: `你是一个专业的浏览器脚本编写助手。用户会描述他们想要的功能，你需要生成可以在浏览器控制台运行的JavaScript代码。
规则：
1. 只返回符合用户需求的JavaScript代码
2. 代码必须用 \`\`\`javascript 和 \`\`\` 包裹
3. 代码应该完整、可直接运行
4. 如果需要操作页面元素，使用用户提供的选择器
5. 不要包含任何解释性文字，除非用户明确要求`,
  temperature: 0.7,
  maxTokens: -1,
  enableKnowledgeBase: true,
};

function AISetting() {
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get("ai_settings");
      if (result.ai_settings) {
        setSettings(result.ai_settings);
      }
    } catch (error) {
      console.error("Failed to load AI settings:", error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ ai_settings: settings });
      Message.success("AI配置保存成功");
    } catch (error) {
      Message.error("保存失败");
      console.error("Failed to save AI settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    Message.info("已重置为默认配置");
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${settings.apiEndpoint}/models`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` }),
        },
      });

      if (response.ok) {
        const data = await response.json();
        Message.success("连接成功！API可用");
        console.log("Available models:", data);
      } else {
        Message.error(`连接失败: ${response.status}`);
      }
    } catch (error) {
      Message.error("连接失败，请检查配置");
      console.error("Connection test failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space className="ai-setting w-full h-full overflow-auto relative" direction="vertical" size={16}>
      <Card title="AI对话配置" bordered={false}>
        <Space direction="vertical" size={20} className="w-full">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-3 flex-1">
              <span className="font-medium mb-1">API端点</span>
              <Input
                placeholder="例如: http://localhost:1234/v1"
                value={settings.apiEndpoint}
                onChange={(value) => setSettings({ ...settings, apiEndpoint: value })}
              />
            </div>
            <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">OpenAI兼容的API端点地址</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-3 flex-1">
              <span className="font-medium mb-1">API密钥</span>
              <Input.Password
                placeholder="可选，如果API需要认证"
                value={settings.apiKey}
                onChange={(value) => setSettings({ ...settings, apiKey: value })}
              />
            </div>
            <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">如果API需要认证，请提供密钥</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-3 flex-1">
              <span className="font-medium mb-1">模型名称</span>
              <Input
                placeholder="例如: gpt-3.5-turbo"
                value={settings.model}
                onChange={(value) => setSettings({ ...settings, model: value })}
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
                value={settings.systemPrompt}
                onChange={(value) => setSettings({ ...settings, systemPrompt: value })}
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
                value={settings.temperature.toString()}
                onChange={(value) => {
                  const num = parseFloat(value);
                  if (!isNaN(num) && num >= 0 && num <= 2) {
                    setSettings({ ...settings, temperature: num });
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
                value={settings.maxTokens.toString()}
                onChange={(value) => {
                  const num = parseInt(value, 10);
                  if (!isNaN(num)) {
                    setSettings({ ...settings, maxTokens: num });
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
                checked={settings.enableKnowledgeBase}
                onChange={(checked) => setSettings({ ...settings, enableKnowledgeBase: checked })}
              />
            </div>
            <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">启用后，AI将使用ScriptCat知识库</span>
          </div>

          <Space direction="horizontal" className="w-full pt-4" size={12}>
            <Button type="primary" loading={loading} onClick={saveSettings}>
              保存配置
            </Button>
            <Button onClick={testConnection} loading={loading}>
              测试连接
            </Button>
            <Button onClick={resetSettings}>重置默认</Button>
          </Space>
        </Space>
      </Card>

      <Card title="使用说明" bordered={false}>
        <Space direction="vertical" size={12} className="w-full">
          <div>
            <div className="font-medium mb-2">如何使用AI对话功能：</div>
            <ul className="text-sm space-y-2 list-disc list-inside">
              <li>配置API端点和模型信息后保存</li>
              <li>点击"测试连接"验证配置是否正确</li>
              <li>在页面中点击扩展图标打开SidePanel</li>
              <li>描述你想要实现的功能，AI会生成相应的JavaScript代码</li>
              <li>点击"运行"按钮直接在当前页面执行代码</li>
              <li>点击"保存"按钮将代码保存到脚本列表</li>
            </ul>
          </div>

          <div>
            <div className="font-medium mb-2">高级功能：</div>
            <ul className="text-sm space-y-2 list-disc list-inside">
              <li>使用元素选择器（🎯）选择页面元素，AI会基于选中的元素生成代码</li>
              <li>右键点击页面选中的文本，选择"AI对话"快速启动</li>
              <li>在对话历史中查看和管理之前的对话</li>
              <li>启用知识库可以获得更准确的ScriptCat相关帮助</li>
            </ul>
          </div>
        </Space>
      </Card>
    </Space>
  );
}

export default AISetting;
