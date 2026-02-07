import { useState, useEffect, useCallback } from "react";
import { Message as ArcoMessage, Modal } from "@arco-design/web-react";
import type { ConversationSession, DomainConversations } from "../types";
import { loadAllConversations, deleteSession, renameSession, deleteDomainConversations } from "../storage";

export const useConversations = () => {
  const [domains, setDomains] = useState<DomainConversations[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const domainList = await loadAllConversations();
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
  }, [selectedDomain]);

  const handleDeleteSession = async () => {
    if (!selectedDomain || !selectedSession) return;

    try {
      await deleteSession(selectedDomain, selectedSession.id);
      ArcoMessage.success("会话已删除");
      setSelectedSession(null);
      await loadData();
    } catch (error) {
      console.error("Failed to delete session:", error);
      ArcoMessage.error("删除失败");
    }
  };

  const handleRenameSession = async (newTitle: string) => {
    if (!selectedDomain || !selectedSession || !newTitle.trim()) return;

    try {
      await renameSession(selectedDomain, selectedSession.id, newTitle);
      ArcoMessage.success("会话已重命名");
      setSelectedSession(null);
      await loadData();
    } catch (error) {
      console.error("Failed to rename session:", error);
      ArcoMessage.error("重命名失败");
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    const domainData = domains.find((d) => d.domain === domain);
    const sessionCount = domainData?.data.sessions.length || 0;

    Modal.confirm({
      title: "确认删除",
      content: `确定要删除域名 "${domain}" 及其所有对话吗？这将删除 ${sessionCount} 个会话，且无法恢复。`,
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: {
        status: "danger",
      },
      onOk: async () => {
        try {
          await deleteDomainConversations(domain);
          ArcoMessage.success("域名对话已删除");
          await loadData();

          if (selectedDomain === domain) {
            setSelectedDomain("");
          }
        } catch (error) {
          console.error("Failed to delete domain:", error);
          ArcoMessage.error("删除失败");
        }
      },
    });
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    domains,
    loading,
    selectedDomain,
    selectedSession,
    setSelectedDomain,
    setSelectedSession,
    loadData,
    handleDeleteSession,
    handleRenameSession,
    handleDeleteDomain,
  };
};
