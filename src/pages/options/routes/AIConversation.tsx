import {
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Message as ArcoMessage,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
} from "@arco-design/web-react";
import { IconDelete, IconEdit, IconRefresh, IconSearch, IconMessage } from "@arco-design/web-react/icon";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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

function AIConversation() {
  const { t } = useTranslation();
  const [domains, setDomains] = useState<DomainConversations[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [detailSession, setDetailSession] = useState<ConversationSession | null>(null);

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
  }, []);

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
        <p>确定要删除会话 "{selectedSession?.title}" 吗？</p>
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
        title={`对话详情 - ${selectedSession?.title || '未选择会话'}`}
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
              {(!selectedSession.messages || selectedSession.messages.length === 0) ? (
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
                    <div className="message-time">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default AIConversation;
