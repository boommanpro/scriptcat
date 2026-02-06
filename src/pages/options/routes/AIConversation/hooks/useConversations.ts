import { useState, useEffect } from "react";
import { Message as ArcoMessage } from "@arco-design/web-react";
import type { ConversationSession, DomainConversations } from "../types";
import { loadAllConversations, deleteSession, renameSession, deleteDomainConversations } from "../utils/storage";

export const useConversations = () => {
  const [domains, setDomains] = useState<DomainConversations[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null);

  const loadData = async () => {
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
  };

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
  };

  useEffect(() => {
    loadData();
  }, []);

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
