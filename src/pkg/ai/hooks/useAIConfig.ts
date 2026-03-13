import { useState, useEffect } from "react";
import { Message as ArcoMessage } from "@arco-design/web-react";
import type { AIConfig } from "./types";
import {
  loadAISettings,
  saveAiConfigs,
  addConfig,
  updateConfig,
  deleteConfig,
  setDefaultConfig,
  testConnection,
  createNewConfig,
  copyConfig,
} from "../storage";

export const useAIConfig = () => {
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const configs = await loadAISettings();
      setAiConfigs(configs);
    } catch (error) {
      console.error("Failed to load AI settings:", error);
    }
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;

    try {
      let configs: AIConfig[];
      if (aiConfigs.find((c) => c.id === editingConfig.id)) {
        configs = updateConfig(aiConfigs, editingConfig);
      } else {
        configs = addConfig(aiConfigs, editingConfig);
      }

      await saveAiConfigs(configs);
      setAiConfigs(configs);
      setShowConfigEditor(false);
      setEditingConfig(null);
      ArcoMessage.success("配置已保存");
    } catch (error) {
      console.error("Failed to save config:", error);
      ArcoMessage.error("保存失败");
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      const configs = deleteConfig(aiConfigs, id);
      await saveAiConfigs(configs);
      setAiConfigs(configs);
      ArcoMessage.success("配置已删除");
    } catch (error) {
      console.error("Failed to delete config:", error);
      ArcoMessage.error("删除失败");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const configs = setDefaultConfig(aiConfigs, id);
      await saveAiConfigs(configs);
      setAiConfigs(configs);
      ArcoMessage.success("已设为默认配置");
    } catch (error) {
      console.error("Failed to set default config:", error);
      ArcoMessage.error("设置失败");
    }
  };

  const handleTestConnection = async (config: AIConfig) => {
    setLoading(true);
    try {
      const success = await testConnection(config);
      if (success) {
        ArcoMessage.success("连接成功！API可用");
      } else {
        ArcoMessage.error("连接失败");
      }
    } catch (error) {
      ArcoMessage.error("连接失败，请检查配置");
      console.error("Connection test failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddConfig = () => {
    const newConfig = createNewConfig();
    setEditingConfig(newConfig);
    setShowConfigEditor(true);
  };

  const handleEditConfig = (config: AIConfig) => {
    setEditingConfig({ ...config });
    setShowConfigEditor(true);
  };

  const handleCopyConfig = (config: AIConfig) => {
    const copiedConfig = copyConfig(config);
    setEditingConfig(copiedConfig);
    setShowConfigEditor(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    aiConfigs,
    editingConfig,
    showConfigEditor,
    loading,
    setEditingConfig,
    setShowConfigEditor,
    handleSaveConfig,
    handleDeleteConfig,
    handleSetDefault,
    handleTestConnection,
    handleAddConfig,
    handleEditConfig,
    handleCopyConfig,
    loadData,
  };
};
