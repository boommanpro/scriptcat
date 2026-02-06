import React, { useEffect } from "react";
import { Select, Tooltip } from "@arco-design/web-react";
import { searchKnowledgeBase, formatKnowledgeForPrompt } from "@App/pkg/utils/knowledge-base";
import { useAIConfig } from "@App/pkg/ai";
import { useChatMessages } from "./hooks/useChatMessages";
import { useElementSelection } from "./hooks/useElementSelection";
import { useConversation } from "./hooks/useConversation";
import { useBrowserExtension } from "./hooks/useBrowserExtension";
import { MessageRenderer } from "./components/MessageRenderer";
import { ElementTags } from "./components/ElementTags";
import { extractCodeBlocks, replaceElementRefs } from "./utils/messageUtils";
import type { Message } from "./types";

export function SidePanelApp() {
  // 使用共享的AI配置hook
  const { aiConfigs, loading: configLoading, loadData: loadAIConfig } = useAIConfig();
  const [selectedConfigId, setSelectedConfigId] = React.useState<string>("");

  // 使用拆分的hooks
  const {
    messages,
    setMessages,
    inputValue,
    setInputValue,
    isLoading,
    setIsLoading,
    selectedMessages,
    expandedMessages,
    messagesEndRef,
    toggleMessageSelection,
    toggleExpandedMessages,
  } = useChatMessages();

  const {
    selectedElements,
    setSelectedElements,
    isSelecting,
    setIsSelecting,
    removeSelectedElement,
    insertElementInfo,
    insertAllElements,
  } = useElementSelection();

  const {
    currentDomain,
    setCurrentDomain,
    domains,
    sessions,
    currentSessionId,
    loadConversationData,
    createNewSession,
    switchToSession,
    saveCurrentConversation,
    refreshDomains,
  } = useConversation();

  const { refreshCurrentPage, copyToClipboard, executeCode, injectExecutionService } = useBrowserExtension();

  // 初始化和事件监听
  useEffect(() => {
    const initSidePanel = async () => {
      console.log("[SidePanel] Sidepanel component mounted, starting initialization...");
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log("[SidePanel] Active tab found:", tab?.id, "url:", tab?.url);
        if (tab?.url) {
          const url = new URL(tab.url);
          const domain = url.hostname;
          setCurrentDomain(domain);
          console.log("[SidePanel] Current domain:", domain);
          const conversationData = await loadConversationData(domain);
          setMessages(conversationData.messages);
          await refreshDomains();
          console.log("[SidePanel] Conversation loaded, injecting execution service...");
          await injectExecutionService();
        } else {
          console.warn("[SidePanel] No URL found in active tab");
        }
      } catch (error: any) {
        console.error("[SidePanel] Failed to initialize side panel:", error);
      }
    };

    initSidePanel();
    loadAIConfig();
  }, []);

  useEffect(() => {
    const handleStorageChanged = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local" && changes.ai_configs) {
        const newConfigs = changes.ai_configs.newValue;
        if (Array.isArray(newConfigs)) {
          const defaultConfig = newConfigs.find((c) => c.isDefault);
          if (defaultConfig && !selectedConfigId) {
            setSelectedConfigId(defaultConfig.id);
          }
          console.log("[SidePanel] AI configs updated:", newConfigs);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [selectedConfigId]);

  useEffect(() => {
    const handleTabActivated = async (activeInfo: { tabId: number; windowId: number }) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab?.url) {
          const url = new URL(tab.url);
          const newDomain = url.hostname;
          console.log("[SidePanel] Tab switched to domain:", newDomain);
          setCurrentDomain(newDomain);
          const conversationData = await loadConversationData(newDomain);
          setMessages(conversationData.messages);
          await refreshDomains();
          // 重置UI状态
          setSelectedMessages(new Set());
        }
      } catch (error: any) {
        console.error("[SidePanel] Failed to handle tab change:", error);
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, []);

  // 核心业务逻辑函数
  const callLLMApi = async (userMessage: string): Promise<void> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const processedMessage = replaceElementRefs(userMessage, selectedElements);

    const context =
      selectedElements.length > 0
        ? "\\n\\n用户选中的页面元素：\\n" +
          selectedElements
            .map((el, idx) => `[元素${idx + 1}] 选择器: ${el.selector}\\n源代码: ${el.outerHTML || ""}`)
            .join("\\n\\n")
        : "";

    const userContent = processedMessage + context;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    };

    const allMessagesForAPI = [...messages, userMsg];

    setMessages(allMessagesForAPI);
    setInputValue("");
    setSelectedElements([]);
    setIsLoading(true);
    setSelectedMessages(new Set());

    if (messages.length === 0 && currentSessionId) {
      const newTitle = userMessage.trim().substring(0, 20) + (userMessage.length > 20 ? "..." : "");
      // 这里需要调用重命名会话的函数
    }

    try {
      const selectedConfig = aiConfigs.find((c) => c.id === selectedConfigId);
      const config = selectedConfig ||
        (aiConfigs.length > 0 ? aiConfigs[0] : null) || {
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

      let systemPrompt =
        config.systemPrompt ||
        `你是一个专业的浏览器脚本编写助手。用户会描述他们想要的功能，你需要生成可以在浏览器控制台运行的JavaScript代码。
            规则：
            1. 只返回符合用户需求的JavaScript代码
            2. 代码必须用 \`\`\`javascript 和 \`\`\` 包裹
            3. 代码应该完整、可直接运行
            4. 如果需要操作页面元素，使用用户提供的选择器
            5. 不要包含任何解释性文字，除非用户明确要求`;

      if (config.enableKnowledgeBase) {
        const knowledgeItems = searchKnowledgeBase(userMessage, 3);
        if (knowledgeItems.length > 0) {
          const knowledgeContext = formatKnowledgeForPrompt(knowledgeItems);
          systemPrompt = `${systemPrompt}\n\n${knowledgeContext}`;
        }
      }

      const requestBody = {
        model: config.model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...allMessagesForAPI.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || -1,
        stream: true,
      };

      const apiResponse = await fetch(`${config.apiEndpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!apiResponse.ok) {
        throw new Error(`API请求失败: ${apiResponse.status}`);
      }

      const reader = apiResponse.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let fullResponseText = "";
      const messageId = Date.now().toString();

      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          codeBlocks: [],
          request: requestBody,
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantMessage += content;
                fullResponseText += content;
                const codeBlocks = extractCodeBlocks(assistantMessage);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId ? ({ ...m, content: assistantMessage, codeBlocks } as Message) : m
                  )
                );
              }
            } catch (_e) {}
          }
        }
      }

      const finalCodeBlocks = extractCodeBlocks(assistantMessage);
      const finalAssistantMsg: Message = {
        id: messageId,
        role: "assistant",
        content: assistantMessage,
        codeBlocks: finalCodeBlocks,
        response: { text: fullResponseText },
        timestamp: Date.now(),
      };

      const finalMessages = [...allMessagesForAPI, finalAssistantMsg];
      setMessages(finalMessages);
      await saveCurrentConversation(currentDomain, finalMessages);
    } catch (error) {
      console.error("API调用失败:", error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `抱歉，发生了错误：${error instanceof Error ? error.message : "未知错误"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      const finalMessagesWithError = [...allMessagesForAPI, errorMsg];
      await saveCurrentConversation(currentDomain, finalMessagesWithError);
    } finally {
      setIsLoading(false);
      setSelectedElements([]);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    await callLLMApi(inputValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startElementSelection = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      alert("无法获取当前标签页");
      return;
    }

    setIsSelecting(true);

    try {
      const response = await chrome.runtime.sendMessage({
        message: "ai-start-selection",
        tabId: tab.id,
        mode: "visual",
      });

      if (!response?.success) {
        throw new Error(response?.error || "Unknown error");
      }
    } catch (error: any) {
      console.error("启动元素选择失败:", error);
      setIsSelecting(false);
      alert(`启动元素选择失败: ${error.message || error}`);
    }
  };

  const stopElementSelection = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setIsSelecting(false);
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        message: "ai-stop-selection",
        tabId: tab.id,
      });
    } catch (error) {
      console.error("停止元素选择失败:", error);
    }
    setIsSelecting(false);
  };

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.message === "ai-element-selected") {
        const newElements = message.data.elements;
        setSelectedElements((prev) => {
          const existingSelectors = new Set(prev.map((el) => el.selector));
          const uniqueNewElements = newElements.filter((el: any) => !existingSelectors.has(el.selector));
          return [...prev, ...uniqueNewElements];
        });
        setIsSelecting(false);
      } else if (message.type === "AI_CHAT_WITH_TEXT") {
        const selectedText = message.text || "";
        if (selectedText) {
          setInputValue((prev) => {
            if (prev) {
              return `${prev}\n\n选中的文本：\n${selectedText}`;
            } else {
              return `选中的文本：\n${selectedText}`;
            }
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleRunCode = async (code: string) => {
    console.log("[SidePanel-HandleRunCode] User clicked run button", {
      codePreview: code.substring(0, 50) + "...",
    });
    const result = await executeCode(code);
    console.log("[SidePanel-HandleRunCode] ========== Final Result ==========");
    if (result && typeof result === "object" && "success" in result) {
      if (result.success) {
        console.log("[SidePanel-HandleRunCode] ✅ 代码执行成功");
        console.log("[SidePanel-HandleRunCode] 结果:", result.result);
        console.log("[SidePanel-HandleRunCode] 类型:", result.type);
      } else {
        console.error("[SidePanel-HandleRunCode] ❌ 代码执行失败:", result.error);
      }
    } else {
      console.log("[SidePanel-HandleRunCode] 结果:", result);
    }
    console.log("[SidePanel-HandleRunCode] ===================================");
  };

  const handleSaveCode = async (code: string) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const url = new URL(tab.url);
    const domain = url.hostname;

    try {
      await chrome.storage.local.set({
        [`ai_script_${domain}_${Date.now()}`]: {
          code: code,
          domain,
          url: tab.url,
          createTime: Date.now(),
        },
      });
      alert("代码已保存到脚本列表");
    } catch (error) {
      console.error("保存失败:", error);
      alert("保存失败");
    }
  };

  // 渲染逻辑
  return (
    <div className="ai-sidepanel">
      {/* 侧边栏会话列表 */}
      <div className="ai-sidebar">
        <div className="ai-sidebar-header">
          <button className="new-chat-btn" onClick={() => createNewSession(currentDomain)}>
            + 新建对话
          </button>
        </div>
        <div className="ai-sidebar-content">
          {sessions.length === 0 ? (
            <div className="sidebar-empty">暂无对话</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`sidebar-session-item ${session.id === currentSessionId ? "active" : ""}`}
                onClick={() => {
                  switchToSession(currentDomain, session.id).then(setMessages);
                }}
              >
                <div className="sidebar-session-title">{session.title}</div>
                <div className="sidebar-session-actions">
                  <button
                    className="sidebar-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newTitle = prompt("请输入新的会话名称:", session.title);
                      if (newTitle && newTitle.trim()) {
                        // 调用重命名函数
                      }
                    }}
                    title="重命名"
                  >
                    ✏️
                  </button>
                  <button
                    className="sidebar-action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`确定要删除会话 "${session.title}" 吗？`)) {
                        // 调用删除函数
                      }
                    }}
                    title="删除"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="ai-sidebar-footer">
          <div className="current-domain-badge">{currentDomain}</div>
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="ai-main">
        <div className="ai-header">
          <div className="header-left">
            <h2>AI 对话</h2>
          </div>
          <div className="header-actions">
            <div className="ai-config-selector">
              <Select
                value={selectedConfigId}
                onChange={setSelectedConfigId}
                placeholder="选择AI配置"
                style={{ width: 180 }}
                size="small"
              >
                {aiConfigs.map((config) => (
                  <Select.Option key={config.id} value={config.id}>
                    <Tooltip content={`模型: ${config.model}`}>
                      <span>
                        {config.name}
                        {config.isDefault && " (默认)"}
                      </span>
                    </Tooltip>
                  </Select.Option>
                ))}
              </Select>
            </div>
            <button
              className="refresh-btn"
              onClick={() => {
                chrome.runtime.openOptionsPage?.();
              }}
              title="管理AI配置"
            >
              ⚙️
            </button>
            <button className="refresh-btn" onClick={refreshCurrentPage} title="刷新页面">
              ↻
            </button>
          </div>
        </div>

        <div className="ai-messages">
          {messages.length === 0 ? (
            <div className="ai-empty">
              <div className="ai-empty-icon">🤖</div>
              <p>我是 AI 助手，可以帮你编写浏览器脚本</p>
              <p>告诉我你想实现什么功能吧！</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageRenderer
                key={msg.id}
                message={msg}
                selectedElements={selectedElements}
                selectedMessages={selectedMessages}
                expandedMessages={expandedMessages}
                toggleMessageSelection={toggleMessageSelection}
                toggleExpandedMessages={toggleExpandedMessages}
                onRunCode={handleRunCode}
                onSaveCode={handleSaveCode}
              />
            ))
          )}
          {isLoading && (
            <div className="ai-message assistant loading">
              <div className="ai-message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ElementTags
          selectedElements={selectedElements}
          onInsertAll={() => {
            const elementsText = insertAllElements();
            setInputValue((prev) => `${elementsText}${prev ? `\n---\n\n${prev}` : ""}`);
          }}
          onInsertElement={(el, idx) => {
            const elementText = insertElementInfo(el, idx);
            setInputValue((prev) => `${elementText}${prev ? `\n---\n\n${prev}` : ""}`);
          }}
          onRemoveElement={removeSelectedElement}
        />

        <div className="ai-input-area">
          <button
            className={`select-element-btn ${isSelecting ? "active" : ""}`}
            onClick={isSelecting ? stopElementSelection : startElementSelection}
            title={isSelecting ? "停止选择" : "选择页面元素"}
          >
            {isSelecting ? "⏹" : "🎯"}
          </button>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="描述你想要的功能..."
            rows={3}
          />
          <button className="send-btn" onClick={handleSend} disabled={isLoading || !inputValue.trim()}>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
