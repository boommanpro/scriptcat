import { Button, Card, Empty, Input, Space, Table, Tag, Tooltip } from "@arco-design/web-react";
import { IconMessage, IconEdit, IconDelete, IconRefresh, IconSearch, IconSettings } from "@arco-design/web-react/icon";
import React, { useState } from "react";
import { useConversations } from "./hooks/useConversations";
import { useAIConfig } from "./hooks/useAIConfig";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { RenameModal } from "./components/RenameModal";
import { ConversationDetailDrawer } from "./components/ConversationDetailDrawer";
import { AIConfigModal } from "./components/AIConfigModal";
import { AIConfigEditorModal } from "./components/AIConfigEditorModal";
import { formatTime } from "./utils/format";
import type { ConversationSession } from "./types";

function AIConversation() {
  const [searchText, setSearchText] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showSettingModal, setShowSettingModal] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");

  const {
    domains,
    loading,
    selectedDomain,
    selectedSession,
    setSelectedDomain,
    setSelectedSession,
    loadData: reloadConversations,
    handleDeleteSession,
    handleRenameSession,
    handleDeleteDomain,
  } = useConversations();

  const {
    aiConfigs,
    editingConfig,
    showConfigEditor,
    loading: configLoading,
    setEditingConfig,
    setShowConfigEditor,
    handleSaveConfig,
    handleDeleteConfig,
    handleSetDefault,
    handleTestConnection: _handleTestConnection,
    handleAddConfig,
    handleEditConfig,
  } = useAIConfig();

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
                setRenameTitle(record.title);
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
              <Button icon={<IconRefresh />} onClick={reloadConversations} loading={loading}>
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

      <DeleteConfirmModal
        visible={showDeleteModal}
        sessionTitle={selectedSession?.title}
        onOk={handleDeleteSession}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedSession(null);
        }}
      />

      <RenameModal
        visible={showRenameModal}
        currentTitle={renameTitle}
        onOk={(newTitle) => {
          handleRenameSession(newTitle);
          setShowRenameModal(false);
          setSelectedSession(null);
          setRenameTitle("");
        }}
        onCancel={() => {
          setShowRenameModal(false);
          setSelectedSession(null);
          setRenameTitle("");
        }}
      />

      <ConversationDetailDrawer
        visible={showDetailDrawer}
        session={selectedSession}
        onClose={() => {
          setShowDetailDrawer(false);
          setSelectedSession(null);
        }}
      />

      <AIConfigModal
        visible={showSettingModal}
        configs={aiConfigs}
        onAddConfig={handleAddConfig}
        onEditConfig={handleEditConfig}
        onDeleteConfig={handleDeleteConfig}
        onSetDefault={handleSetDefault}
        onClose={() => setShowSettingModal(false)}
      />

      <AIConfigEditorModal
        visible={showConfigEditor}
        config={editingConfig}
        onSave={handleSaveConfig}
        onCancel={() => {
          setShowConfigEditor(false);
          setEditingConfig(null);
        }}
        onChange={setEditingConfig}
        loading={configLoading}
      />
    </div>
  );
}

export default AIConversation;
