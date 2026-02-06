import {
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Message as ArcoMessage,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from "@arco-design/web-react";
import {
  IconCheck,
  IconDelete,
  IconEdit,
  IconMessage,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
} from "@arco-design/web-react/icon";
import React, { useEffect, useState } from "react";

interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: any[];
  deleted?: boolean;
}

interface ConversationData {
  sessions: ConversationSession[];
  currentSessionId?: string;
}

interface DomainConversations {
  domain: string;
  data: ConversationData;
}

export interface AIConfig {
  id: string;
  name: string;
  isDefault: boolean;
  apiEndpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enableKnowledgeBase: boolean;
}

function AIConversation() {
  // const { t } = useTranslation(); // 暂时注释掉未使用的翻译hook
  const [domains, setDomains] = useState<DomainConversations[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  // const [detailSession, setDetailSession] = useState<ConversationSession | null>(null); // 暂时注释掉未使用的状态
  const [showSettingModal, setShowSettingModal] = useState(false);
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);

  const loadAllConversations = async () => {
    console.log("[AIConversation] Loading all conversations...");
    setLoading(true);
    try {
      const allStorage = await chrome.storage.local.get(null);
      console.log("[AIConversation] Storage keys:", Object.keys(allStorage));
      const domainList: DomainConversations[] = [];

      for (const key of Object.keys(allStorage)) {
        if (key.startsWith("ai_conversations_")) {
          const domain = key.replace("ai_conversations_", "");
          const rawData = allStorage[key];

          if (!rawData || typeof rawData !== "object") {
            console.warn(`Invalid data for domain ${domain}, skipping`);
            continue;
          }

          const data = rawData as ConversationData;
          const activeSessions = data.sessions?.filter((s) => !s.deleted) || [];

          if (activeSessions.length > 0) {
            domainList.push({
              domain,
              data: {
                ...data,
                sessions: activeSessions,
              },
            });
          }
        }
      }

      domainList.sort((a, b) => b.domain.localeCompare(a.domain));
      console.log("[AIConversation] Loaded domains:", domainList);
      setDomains(domainList);

      if (domainList.length > 0 && !selectedDomain) {
        setSelectedDomain(domainList[0].domain);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
      ArcoMessage.error("加载对话失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllConversations();
    loadAISettings();
  }, []);

  const loadAISettings = async () => {
    try {
      const result = await chrome.storage.local.get(["ai_configs", "ai_settings"]);

      if (result.ai_configs && Array.isArray(result.ai_configs)) {
        setAiConfigs(result.ai_configs);
      } else if (result.ai_settings) {
        const oldSettings = result.ai_settings;
        const newConfig: AIConfig = {
          id: "default",
          name: "默认配置",
          isDefault: true,
          apiEndpoint: oldSettings.apiEndpoint || "http://localhost:1234/v1",
          apiKey: oldSettings.apiKey || "",
          model: oldSettings.model || "qwen/qwen3-4b-2507",
          systemPrompt:
            oldSettings.systemPrompt ||
            `你是一个专业的浏览器脚本编写助手。用户会描述他们想要的功能，你需要生成可以在浏览器控制台运行的JavaScript代码。
规则：
1. 只返回符合用户需求的JavaScript代码
2. 代码必须用 \`\`\`javascript 和 \`\`\` 包裹
3. 代码应该完整、可直接运行
4. 如果需要操作页面元素，使用用户提供的选择器
5. 不要包含任何解释性文字，除非用户明确要求`,
          temperature: oldSettings.temperature ?? 0.7,
          maxTokens: oldSettings.maxTokens ?? -1,
          enableKnowledgeBase: oldSettings.enableKnowledgeBase ?? true,
        };
        const configs = [newConfig];
        setAiConfigs(configs);
        await chrome.storage.local.set({ ai_configs: configs });
        await chrome.storage.local.remove("ai_settings");
      }
    } catch (error) {
      console.error("Failed to load AI settings:", error);
    }
  };

  const saveAiConfigs = async (configs: AIConfig[]) => {
    await chrome.storage.local.set({ ai_configs: configs });
    setAiConfigs(configs);
  };

  const handleAddConfig = () => {
    const newConfig: AIConfig = {
      id: Date.now().toString(),
      name: "新配置",
      isDefault: false,
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
    setEditingConfig(newConfig);
    setShowConfigEditor(true);
  };

  const handleEditConfig = (config: AIConfig) => {
    setEditingConfig({ ...config });
    setShowConfigEditor(true);
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;

    let configs: AIConfig[];
    if (aiConfigs.find((c) => c.id === editingConfig.id)) {
      configs = aiConfigs.map((c) => (c.id === editingConfig.id ? editingConfig : c));
    } else {
      configs = [...aiConfigs, editingConfig];
    }

    await saveAiConfigs(configs);
    setShowConfigEditor(false);
    setEditingConfig(null);
    ArcoMessage.success("配置已保存");
  };

  const handleDeleteConfig = async (id: string) => {
    const configs = aiConfigs.filter((c) => c.id !== id);
    await saveAiConfigs(configs);
    ArcoMessage.success("配置已删除");
  };

  const handleSetDefault = async (id: string) => {
    const configs = aiConfigs.map((c) => ({
      ...c,
      isDefault: c.id === id,
    }));
    await saveAiConfigs(configs);
    ArcoMessage.success("已设为默认配置");
  };

  const handleDeleteSession = async () => {
    if (!selectedDomain || !selectedSession) return;

    try {
      const result = await chrome.storage.local.get(`ai_conversations_${selectedDomain}`);
      const data = result[`ai_conversations_${selectedDomain}`] as ConversationData;

      const updatedSessions = data.sessions.map((session) => {
        if (session.id === selectedSession.id) {
          return { ...session, deleted: true };
        }
        return session;
      });

      await chrome.storage.local.set({
        [`ai_conversations_${selectedDomain}`]: {
          sessions: updatedSessions,
          currentSessionId: data.currentSessionId,
        },
      });

      ArcoMessage.success("会话已删除");
      setShowDeleteModal(false);
      setSelectedSession(null);
      await loadAllConversations();
    } catch (error) {
      console.error("Failed to delete session:", error);
      ArcoMessage.error("删除失败");
    }
  };

  const handleRenameSession = async () => {
    if (!selectedDomain || !selectedSession || !newTitle.trim()) return;

    try {
      const result = await chrome.storage.local.get(`ai_conversations_${selectedDomain}`);
      const data = result[`ai_conversations_${selectedDomain}`] as ConversationData;

      const updatedSessions = data.sessions.map((session) => {
        if (session.id === selectedSession.id) {
          return { ...session, title: newTitle.trim(), updatedAt: Date.now() };
        }
        return session;
      });

      await chrome.storage.local.set({
        [`ai_conversations_${selectedDomain}`]: {
          sessions: updatedSessions,
          currentSessionId: data.currentSessionId,
        },
      });

      ArcoMessage.success("会话已重命名");
      setShowRenameModal(false);
      setSelectedSession(null);
      setNewTitle("");
      await loadAllConversations();
    } catch (error) {
      console.error("Failed to rename session:", error);
      ArcoMessage.error("重命名失败");
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    if (!confirm(`确定要删除 ${domain} 的所有对话吗？此操作不可恢复。`)) {
      return;
    }

    try {
      await chrome.storage.local.remove(`ai_conversations_${domain}`);
      ArcoMessage.success("域名对话已删除");
      await loadAllConversations();

      if (selectedDomain === domain) {
        setSelectedDomain("");
      }
    } catch (error) {
      console.error("Failed to delete domain:", error);
      ArcoMessage.error("删除失败");
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "今天 " + date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "昨天 " + date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString("zh-CN");
    }
  };

  const filteredDomains = domains.filter((d) => d.domain.toLowerCase().includes(searchText.toLowerCase()));

  const currentDomainData = domains.find((d) => d.domain === selectedDomain);
  const currentSessions = currentDomainData?.data.sessions || [];

  const columns = [
    {
      title: "会话标题",
      dataIndex: "title",
      key: "title",
      render: (title: string, record: ConversationSession) => (
        <Space>
          <span>{title}</span>
          {record.id === currentDomainData?.data.currentSessionId && (
            <Tag color="arcoblue" size="small">
              当前
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "消息数量",
      dataIndex: "messages",
      key: "messageCount",
      width: 120,
      render: (messages: any[]) => messages.length,
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 150,
      render: (updatedAt: number) => formatTime(updatedAt),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (createdAt: number) => formatTime(createdAt),
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: any, record: ConversationSession) => (
        <Space>
          <Tooltip content="查看详情">
            <Button
              type="text"
              size="small"
              icon={<IconMessage />}
              onClick={() => {
                setSelectedSession(record);
                setShowDetailDrawer(true);
              }}
            />
          </Tooltip>
          <Tooltip content="重命名">
            <Button
              type="text"
              size="small"
              icon={<IconEdit />}
              onClick={() => {
                setSelectedSession(record);
                setNewTitle(record.title);
                setShowRenameModal(true);
              }}
            />
          </Tooltip>
          <Tooltip content="删除">
            <Button
              type="text"
              size="small"
              status="danger"
              icon={<IconDelete />}
              onClick={() => {
                setSelectedSession(record);
                setShowDeleteModal(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="ai-conversation-page">
      <Card title="AI对话管理" bordered={false}>
        <Space direction="vertical" size={16} className="w-full">
          <div className="flex items-center justify-between">
            <Space>
              <Input
                placeholder="搜索域名..."
                prefix={<IconSearch />}
                value={searchText}
                onChange={setSearchText}
                style={{ width: 300 }}
                allowClear
              />
              <Button icon={<IconRefresh />} onClick={loadAllConversations} loading={loading}>
                刷新
              </Button>
              <Button icon={<IconSettings />} onClick={() => setShowSettingModal(true)}>
                AI设置
              </Button>
            </Space>
            <div className="text-sm text-gray-500">
              共 {filteredDomains.length} 个域名，{currentSessions.length} 个会话
            </div>
          </div>

          <div className="flex gap-4" style={{ minHeight: 400 }}>
            <div className="domain-list" style={{ width: 250, flexShrink: 0 }}>
              <div className="text-sm font-medium mb-2">域名列表</div>
              {filteredDomains.length === 0 ? (
                <Empty description="暂无对话" />
              ) : (
                <div className="domain-items">
                  {filteredDomains.map((item) => (
                    <div
                      key={item.domain}
                      className={`domain-item ${item.domain === selectedDomain ? "active" : ""}`}
                      onClick={() => setSelectedDomain(item.domain)}
                    >
                      <div className="flex items-center justify-between flex-1">
                        <span className="domain-name">{item.domain}</span>
                        <Tag size="small">{item.data.sessions.length}</Tag>
                      </div>
                      <Button
                        type="text"
                        size="mini"
                        status="danger"
                        icon={<IconDelete />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDomain(item.domain);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="session-list flex-1">
              {selectedDomain ? (
                <>
                  <div className="text-sm font-medium mb-2">{selectedDomain} 的会话</div>
                  {currentSessions.length === 0 ? (
                    <Empty description="该域名暂无会话" />
                  ) : (
                    <Table
                      columns={columns}
                      data={currentSessions}
                      pagination={false}
                      rowKey="id"
                      size="small"
                      border={true}
                    />
                  )}
                </>
              ) : (
                <Empty description="请选择一个域名查看会话" />
              )}
            </div>
          </div>
        </Space>
      </Card>

      <Modal
        title="确认删除"
        visible={showDeleteModal}
        onOk={handleDeleteSession}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedSession(null);
        }}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ status: "danger" }}
      >
        <p>确定要删除会话 &quot;{selectedSession?.title}&quot; 吗？</p>
        <p className="text-gray-500 text-sm">此操作不可恢复。</p>
      </Modal>

      <Modal
        title="重命名会话"
        visible={showRenameModal}
        onOk={handleRenameSession}
        onCancel={() => {
          setShowRenameModal(false);
          setSelectedSession(null);
          setNewTitle("");
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input placeholder="请输入新的会话名称" value={newTitle} onChange={setNewTitle} maxLength={100} autoFocus />
      </Modal>

      <Drawer
        title={`对话详情 - ${selectedSession?.title || "未选择会话"}`}
        visible={showDetailDrawer}
        width={800}
        onCancel={() => {
          setShowDetailDrawer(false);
          setSelectedSession(null);
        }}
        footer={null}
      >
        {selectedSession && (
          <div className="conversation-detail">
            <div className="detail-header">
              <Space>
                <Tag color="arcoblue">消息数量: {selectedSession.messages?.length || 0}</Tag>
                <Tag color="green">创建时间: {formatTime(selectedSession.createdAt)}</Tag>
                <Tag color="orangered">更新时间: {formatTime(selectedSession.updatedAt)}</Tag>
              </Space>
            </div>
            <div className="detail-messages">
              {!selectedSession.messages || selectedSession.messages.length === 0 ? (
                <Empty description="暂无消息" />
              ) : (
                selectedSession.messages.map((msg: any, index: number) => (
                  <div key={index} className={`detail-message ${msg.role}`}>
                    <div className="message-role">
                      {msg.role === "user" ? "用户" : msg.role === "assistant" ? "AI助手" : "系统"}
                    </div>
                    <div className="message-content">
                      <pre>{msg.content}</pre>
                    </div>
                    <div className="message-time">{formatTime(msg.timestamp)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* AI配置管理弹窗 */}
      <Modal
        title="AI配置管理"
        visible={showSettingModal}
        onCancel={() => setShowSettingModal(false)}
        footer={null}
        width={1100}
      >
        <div className="ai-config-modal">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-500">共 {aiConfigs.length} 个配置</div>
            <Button icon={<IconPlus />} onClick={handleAddConfig}>
              新增配置
            </Button>
          </div>

          {aiConfigs.length === 0 ? (
            <Empty description="暂无AI配置" />
          ) : (
            <Table
              data={aiConfigs}
              rowKey="id"
              size="small"
              border={true}
              columns={[
                {
                  title: "名称",
                  dataIndex: "name",
                  key: "name",
                  render: (name: string, record: AIConfig) => (
                    <Space>
                      <span>{name}</span>
                      {record.isDefault && (
                        <Tag color="arcoblue" size="small">
                          <IconCheck /> 默认
                        </Tag>
                      )}
                    </Space>
                  ),
                },
                {
                  title: "模型",
                  dataIndex: "model",
                  key: "model",
                  width: 250,
                },
                {
                  title: "API端点",
                  dataIndex: "apiEndpoint",
                  key: "apiEndpoint",
                  width: 280,
                  render: (endpoint: string) => (
                    <Tooltip content={endpoint}>
                      <span className="truncate block w-full">{endpoint}</span>
                    </Tooltip>
                  ),
                },
                {
                  title: "操作",
                  key: "actions",
                  width: 200,
                  render: (_: any, record: AIConfig) => (
                    <Space>
                      {!record.isDefault && (
                        <Tooltip content="设为默认">
                          <Button type="text" size="small" onClick={() => handleSetDefault(record.id)}>
                            设为默认
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip content="编辑">
                        <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEditConfig(record)} />
                      </Tooltip>
                      {!record.isDefault && (
                        <Tooltip content="删除">
                          <Popconfirm title="确定要删除此配置吗？" onOk={() => handleDeleteConfig(record.id)}>
                            <Button type="text" size="small" status="danger" icon={<IconDelete />} />
                          </Popconfirm>
                        </Tooltip>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </div>
      </Modal>

      {/* AI配置编辑器弹窗 */}
      <Modal
        title={editingConfig?.id ? "编辑AI配置" : "新增AI配置"}
        visible={showConfigEditor}
        onOk={handleSaveConfig}
        onCancel={() => {
          setShowConfigEditor(false);
          setEditingConfig(null);
        }}
        okText="保存"
        cancelText="取消"
        width={1000}
      >
        {editingConfig && (
          <Space direction="vertical" size={20} className="w-full">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-3 flex-1">
                <span className="font-medium mb-1">配置名称</span>
                <Input
                  placeholder="例如: GPT-4 通用配置"
                  value={editingConfig.name}
                  onChange={(value) => setEditingConfig({ ...editingConfig, name: value })}
                />
              </div>
              <span className="text-xs max-w-60 text-right ml-6 flex-shrink-">用于识别此配置的名称</span>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-3 flex-1">
                <span className="font-medium mb-1">API端点</span>
                <Input
                  placeholder="例如: http://localhost:1234/v1"
                  value={editingConfig.apiEndpoint}
                  onChange={(value) => setEditingConfig({ ...editingConfig, apiEndpoint: value })}
                />
              </div>
              <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">OpenAI兼容的API端点地址</span>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-3 flex-1">
                <span className="font-medium mb-1">API密钥</span>
                <Input.Password
                  placeholder="可选，如果API需要认证"
                  value={editingConfig.apiKey}
                  onChange={(value) => setEditingConfig({ ...editingConfig, apiKey: value })}
                />
              </div>
              <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">如果API需要认证，请提供密钥</span>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-3 flex-1">
                <span className="font-medium mb-1">模型名称</span>
                <Input
                  placeholder="例如: gpt-3.5-turbo"
                  value={editingConfig.model}
                  onChange={(value) => setEditingConfig({ ...editingConfig, model: value })}
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
                  value={editingConfig.systemPrompt}
                  onChange={(value) => setEditingConfig({ ...editingConfig, systemPrompt: value })}
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
                  value={editingConfig.temperature.toString()}
                  onChange={(value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num) && num >= 0 && num <= 2) {
                      setEditingConfig({ ...editingConfig, temperature: num });
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
                  value={editingConfig.maxTokens.toString()}
                  onChange={(value) => {
                    const num = parseInt(value, 10);
                    if (!isNaN(num)) {
                      setEditingConfig({ ...editingConfig, maxTokens: num });
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
                  checked={editingConfig.enableKnowledgeBase}
                  onChange={(checked) => setEditingConfig({ ...editingConfig, enableKnowledgeBase: checked })}
                />
              </div>
              <span className="text-xs max-w-60 text-right ml-6 flex-shrink-0">启用后，AI将使用ScriptCat知识库</span>
            </div>

            <Space direction="horizontal" className="w-full pt-4" size={12}>
              <Button type="primary" onClick={handleSaveConfig}>
                保存配置
              </Button>
              <Button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const response = await fetch(`${editingConfig.apiEndpoint}/models`, {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                        ...(editingConfig.apiKey && { Authorization: `Bearer ${editingConfig.apiKey}` }),
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
                    setLoading(false);
                  }
                }}
                loading={loading}
              >
                测试连接
              </Button>
            </Space>
          </Space>
        )}
      </Modal>
    </div>
  );
}

export default AIConversation;
