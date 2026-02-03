import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "@arco-design/web-react";
import "@arco-design/web-react/dist/css/arco.css";
import "./sidepanel.css";
import { searchKnowledgeBase, formatKnowledgeForPrompt } from "@App/pkg/utils/knowledge-base";

interface SelectedElement {
  selector: string;
  tagName: string;
  textContent?: string;
  outerHTML?: string;
  href?: string;
  src?: string;
  id?: string;
  className?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  codeBlocks?: CodeBlock[];
  request?: object;
  response?: object;
}

interface CodeBlock {
  id: string;
  code: string;
  language: string;
  executed?: boolean;
  saved?: boolean;
}

const getLocale = (): any => {
  return {};
};

function SidePanelContent() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentDomain, setCurrentDomain] = React.useState("");
  const [domains, setDomains] = React.useState<string[]>([]);
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());
  const [selectedElements, setSelectedElements] = React.useState<SelectedElement[]>([]);
  const [isSelecting, setIsSelecting] = React.useState(false);
  const [showDomainSelector, setShowDomainSelector] = React.useState(false);
  const [expandedMessages, setExpandedMessages] = React.useState<Set<string>>(new Set());
  const [showHistoryPanel, setShowHistoryPanel] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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
          await loadConversation(domain);
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
  }, []);

  React.useEffect(() => {
    const handleTabActivated = async (activeInfo: { tabId: number; windowId: number }) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab?.url) {
          const url = new URL(tab.url);
          const newDomain = url.hostname;
          console.log("[SidePanel] Tab switched to domain:", newDomain);
          setCurrentDomain(newDomain);
          await loadConversation(newDomain);
          await refreshDomains();
          setSelectedMessages(new Set());
          setShowDomainSelector(false);
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

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = async (domain: string) => {
    try {
      const result = await chrome.storage.local.get(`ai_conversation_${domain}`);
      if (result[`ai_conversation_${domain}`]) {
        setMessages(result[`ai_conversation_${domain}`]);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
      setMessages([]);
    }
  };

  const getAllConversationDomains = async (): Promise<string[]> => {
    try {
      const allStorage = await chrome.storage.local.get(null);
      const domainSet = new Set<string>();
      for (const key of Object.keys(allStorage)) {
        if (key.startsWith("ai_conversation_")) {
          const domain = key.replace("ai_conversation_", "");
          domainSet.add(domain);
        }
      }
      return Array.from(domainSet).sort();
    } catch (error) {
      console.error("Failed to get all domains:", error);
      return [];
    }
  };

  const handleSwitchDomain = async (domain: string) => {
    setCurrentDomain(domain);
    await loadConversation(domain);
    setSelectedMessages(new Set());
    setShowDomainSelector(false);
  };

  const refreshDomains = async () => {
    const domainList = await getAllConversationDomains();
    setDomains(domainList);
  };

  const deleteConversation = async (domain: string) => {
    try {
      await chrome.storage.local.remove(`ai_conversation_${domain}`);
      await refreshDomains();
      if (domain === currentDomain) {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const clearCurrentConversation = async () => {
    try {
      await chrome.storage.local.remove(`ai_conversation_${currentDomain}`);
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear conversation:", error);
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const toggleExpandedMessages = (messageId: string) => {
    setExpandedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const refreshCurrentPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.reload(tab.id);
      }
    } catch (error) {
      console.error("Failed to refresh page:", error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const removeSelectedElement = (index: number) => {
    setSelectedElements((prev) => prev.filter((_, i) => i !== index));
  };

  const saveConversation = async (domain: string, msgs: Message[]) => {
    try {
      await chrome.storage.local.set({
        [`ai_conversation_${domain}`]: msgs,
      });
    } catch (error) {
      console.error("Failed to save conversation:", error);
    }
  };

  const extractCodeBlocks = (content: string): CodeBlock[] => {
    const codeBlockRegex = /```javascript\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        id: Math.random().toString(36).substr(2, 9),
        code: match[1],
        language: "javascript",
      });
    }
    return blocks;
  };

  const parseElementRefs = (content: string, elements: SelectedElement[]) => {
    const elementRefRegex = /\[(\d+)\]/g;
    const parts: Array<{ type: "text" | "element-ref"; content: string; index?: number }> = [];
    let lastIndex = 0;
    let match;

    while ((match = elementRefRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
      }
      const elementIndex = parseInt(match[1], 10) - 1;
      if (elementIndex >= 0 && elementIndex < elements.length) {
        parts.push({ type: "element-ref", content: match[0], index: elementIndex });
      } else {
        parts.push({ type: "text", content: match[0] });
      }
      lastIndex = elementRefRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({ type: "text", content: content.slice(lastIndex) });
    }

    return parts;
  };

  const replaceElementRefs = (content: string, elements: SelectedElement[]) => {
    return content.replace(/\[(\d+)\]/g, (_, num) => {
      const idx = parseInt(num, 10) - 1;
      if (idx >= 0 && idx < elements.length) {
        const el = elements[idx];
        return `[元素${num}] 选择器: ${el.selector}\n源代码: ${el.outerHTML || ""}`;
      }
      return `[${num}]`;
    });
  };

  const callLLMApi = async (userMessage: string): Promise<void> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const processedMessage = replaceElementRefs(userMessage, selectedElements);

    const context =
      selectedElements.length > 0
        ? `\n\n用户选中的页面元素：\n${selectedElements.map((el, idx) => `[元素${idx + 1}] 选择器: ${el.selector}\n源代码: ${el.outerHTML || ""}`).join("\n\n")}`
        : "";

    const userContent = processedMessage + context;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    };

    const selectedHistoryMessages = messages.filter((m) => selectedMessages.has(m.id));
    const messagesWithContext = [...selectedHistoryMessages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setSelectedElements([]);
    setIsLoading(true);
    setSelectedMessages(new Set());

    try {
      const configResult = await chrome.storage.local.get("ai_settings");
      const config = configResult.ai_settings || {
        apiEndpoint: "http://localhost:1234/v1",
        apiKey: "",
        model: "qwen/qwen3-4b-2507",
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
          ...messagesWithContext.map((m) => ({
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

      const assistantMsg: Message = {
        id: messageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        codeBlocks: [],
        request: requestBody,
      };

      setMessages((prev) => [...prev, assistantMsg]);

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
            } catch (_e) {
            }
          }
        }
      }

      const finalCodeBlocks = extractCodeBlocks(assistantMessage);
      const finalAssistantMsg: Message = {
        ...assistantMsg,
        content: assistantMessage,
        codeBlocks: finalCodeBlocks,
        response: { text: fullResponseText },
      };

      setMessages((prev) => prev.map((m) => (m.id === messageId ? finalAssistantMsg : m)));

      await saveConversation(currentDomain, [...messagesWithContext, finalAssistantMsg]);
    } catch (error) {
      console.error("API调用失败:", error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `抱歉，发生了错误：${error instanceof Error ? error.message : "未知错误"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
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

  const formatElementRef = (element: SelectedElement, index: number) => {
    return `### [${index + 1}] 元素引用
**选择器**: \`${element.selector}\`
**源代码**:
\`\`\`html
${element.outerHTML || ""}
\`\`\`
`;
  };

  const insertElementInfo = (element: SelectedElement, index: number) => {
    const elementText = formatElementRef(element, index);
    setInputValue((prev) => `${elementText}${prev ? `\n---\n\n${prev}` : ""}`);
  };

  const insertAllElements = () => {
    if (selectedElements.length === 0) return;
    const elementsText = selectedElements.map((el, idx) => formatElementRef(el, idx)).join("");
    setInputValue((prev) => `${elementsText}${prev ? `\n---\n\n${prev}` : ""}`);
  };

  React.useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.message === "ai-element-selected") {
        const newElements = message.data.elements as SelectedElement[];
        setSelectedElements((prev) => {
          const existingSelectors = new Set(prev.map((el) => el.selector));
          const uniqueNewElements = newElements.filter((el) => !existingSelectors.has(el.selector));
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

  const executeCode = async (code: string) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn("[SidePanel-ExecuteCode] No active tab found");
      return { success: false, error: "No tab" };
    }

    console.log("[SidePanel-ExecuteCode] Starting execution", {
      tabId: tab.id,
      codePreview: code.substring(0, 50) + "...",
    });

    try {
      const result = await chrome.runtime.sendMessage({
        message: "ai-execute-code",
        tabId: tab.id,
        code,
      });
      console.log("[SidePanel-ExecuteCode] Execution result:", result);
      return result;
    } catch (error: any) {
      console.error("[SidePanel-ExecuteCode] Code execution failed:", error);
      return { success: false, error: String(error) };
    }
  };

  const injectExecutionService = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.log("[SidePanel] No active tab found, skipping injection");
      return;
    }

    console.log("[SidePanel] Starting AI Code Executor injection for tab:", tab.id, "url:", tab.url);

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => {
          const AI_SERVICE = "ai-code-executor";
          console.log("[Page] AI Code Executor script starting...");

          if ((window as any)[AI_SERVICE]) {
            console.log("[Page] AI Code Executor already exists, skipping");
            return;
          }

          function executeCode(code: string) {
            console.log("[Page] Executing code:", code.substring(0, 100) + "...");
            try {
              const fn = new Function(code);
              const result = fn();
              console.log("[Page] Code execution success, result:", result);
              return { success: true, result: String(result), type: typeof result };
            } catch (error: any) {
              console.error("[Page] Code execution failed:", error);
              return { success: false, error: String(error), errorType: error.constructor.name };
            }
          }

          (window as any)[AI_SERVICE] = { execute: executeCode, serviceName: AI_SERVICE };
          console.log("[Page] AI Code Executor attached to window");

          if (chrome && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
              console.log("[Page] Received message:", message.type, "executionId:", message.executionId);
              if (message.type === AI_SERVICE) {
                const result = executeCode(message.code);
                console.log("[Page] Sending response:", result);
                sendResponse({ ...result, executionId: message.executionId });
              }
              return true;
            });
            console.log("[Page] Message listener registered");
          } else {
            console.warn("[Page] chrome.runtime.onMessage not available");
          }

          console.log("[Page] AI Code Executor Service initialized successfully");
        },
      });

      console.log("[SidePanel] AI Code Executor service injected successfully for tab:", tab.id);
    } catch (error: any) {
      console.error("[SidePanel] Failed to inject execution service:", error);
    }
  };

  const handleRunCode = async (codeBlock: CodeBlock) => {
    console.log("[SidePanel-HandleRunCode] User clicked run button", {
      codePreview: codeBlock.code.substring(0, 50) + "...",
    });
    const result = await executeCode(codeBlock.code);
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

  const handleSaveCode = async (codeBlock: CodeBlock) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const url = new URL(tab.url);
    const domain = url.hostname;

    try {
      await chrome.storage.local.set({
        [`ai_script_${domain}_${Date.now()}`]: {
          code: codeBlock.code,
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

  const renderMessageContent = (content: string) => {
    const parts = parseElementRefs(content, selectedElements);

    return (
      <div className="message-text">
        {parts.map((part, idx) => {
          if (part.type === "element-ref" && part.index !== undefined) {
            const el = selectedElements[part.index];
            return (
              <span key={idx} className="element-ref-tag" title={`${el?.tagName}: ${el?.selector}`}>
                {part.content}
              </span>
            );
          }
          return <span key={idx}>{part.content}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="ai-sidepanel">
      <div className="ai-header">
        <h2>AI 对话</h2>
        <div className="header-actions">
          <button className="history-btn" onClick={() => setShowHistoryPanel(true)} title="对话历史">
            📜
          </button>
          <button className="refresh-btn" onClick={refreshCurrentPage} title="刷新页面">
            ↻
          </button>
          <div className="domain-selector-container">
            <button
              className="domain-selector-btn"
              onClick={() => {
                refreshDomains();
                setShowDomainSelector(!showDomainSelector);
              }}
            >
              {currentDomain || "选择域名"} ▼
            </button>
            {showDomainSelector && (
              <div className="domain-dropdown">
                {domains.length === 0 ? (
                  <div className="domain-empty">暂无对话历史</div>
                ) : (
                  domains.map((domain) => (
                    <div
                      key={domain}
                      className={`domain-item ${domain === currentDomain ? "active" : ""}`}
                      onClick={() => handleSwitchDomain(domain)}
                    >
                      {domain}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ai-messages">
        {messages.length === 0 ? (
          <div className="ai-empty">
            <div className="ai-empty-icon">🤖</div>
            <p>我是 AI 助手，可以帮你编写浏览器脚本</p>
            <p>告诉我你想实现什么功能吧！</p>
            {messages.length > 0 && <p className="ai-empty-hint">勾选左侧消息可选择发送给 AI 的历史对话</p>}
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`ai-message ${msg.role}`}>
              <div
                className={`message-checkbox ${selectedMessages.has(msg.id) ? "checked" : ""}`}
                onClick={() => toggleMessageSelection(msg.id)}
              >
                <input type="checkbox" checked={selectedMessages.has(msg.id)} readOnly />
              </div>
              {msg.role === "assistant" && msg.codeBlocks && msg.codeBlocks.length > 0 && (
                <div
                  className={`debug-toggle ${expandedMessages.has(msg.id) ? "expanded" : ""}`}
                  onClick={() => toggleExpandedMessages(msg.id)}
                >
                  {expandedMessages.has(msg.id) ? "▼" : "▶"}
                </div>
              )}
              <div className="ai-message-content">
                {msg.role === "user" ? (
                  renderMessageContent(msg.content)
                ) : (
                  <div className="message-text">
                    {msg.content.split(/(```javascript[\s\S]*?```)/g).map((part, index) => {
                      if (part.startsWith("```javascript") && part.endsWith("```")) {
                        const code = part.slice(14, -3);
                        const codeBlock = msg.codeBlocks?.[Math.floor(index / 2)];
                        return (
                          <div key={index} className="code-block">
                            <pre>
                              <code>{code}</code>
                            </pre>
                            <div className="code-actions">
                              <button className="run-btn" onClick={() => codeBlock && handleRunCode(codeBlock)}>
                                运行
                              </button>
                              <button className="save-btn" onClick={() => codeBlock && handleSaveCode(codeBlock)}>
                                保存
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return part && <span key={index}>{part}</span>;
                    })}
                  </div>
                )}
              </div>
              {msg.role === "assistant" && expandedMessages.has(msg.id) && (
                <div className="debug-panel">
                  <div className={`debug-section ${expandedMessages.has(msg.id) ? "expanded" : ""}`}>
                    <div className="debug-header">
                      <span className="debug-title">Request</span>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(JSON.stringify(msg.request, null, 2))}
                      >
                        复制
                      </button>
                    </div>
                    <pre className="debug-content">{JSON.stringify(msg.request, null, 2)}</pre>
                  </div>
                  <div className={`debug-section ${expandedMessages.has(msg.id) ? "expanded" : ""}`}>
                    <div className="debug-header">
                      <span className="debug-title">Response</span>
                      <button
                        className="copy-btn"
                        onClick={() => {
                          const responseText =
                            typeof msg.response === "object" && "text" in msg.response
                              ? (msg.response as any).text
                              : JSON.stringify(msg.response, null, 2);
                          copyToClipboard(responseText);
                        }}
                      >
                        复制
                      </button>
                    </div>
                    <pre className="debug-content">
                      {typeof msg.response === "object" && "text" in msg.response
                        ? (msg.response as any).text
                        : JSON.stringify(msg.response, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
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

      {selectedElements.length > 0 && (
        <div className="element-tags">
          <div className="element-tags-header">
            <button className="insert-all-btn" onClick={insertAllElements}>
              插入全部
            </button>
          </div>
          <div className="element-tags-list">
            {selectedElements.map((el, index) => (
              <div key={index} className="element-tag">
                <span className="element-tag-text" title={el.selector}>
                  {el.tagName}
                </span>
                <span className="element-tag-insert" onClick={() => insertElementInfo(el, index)} title="插入到输入框">
                  📥
                </span>
                <span className="element-tag-remove" onClick={() => removeSelectedElement(index)}>
                  ×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {showHistoryPanel && (
        <div className="history-panel-overlay" onClick={() => setShowHistoryPanel(false)}>
          <div className="history-panel" onClick={(e) => e.stopPropagation()}>
            <div className="history-panel-header">
              <h3>对话历史</h3>
              <button className="close-btn" onClick={() => setShowHistoryPanel(false)}>
                ×
              </button>
            </div>
            <div className="history-panel-content">
              {domains.length === 0 ? (
                <div className="history-empty">暂无对话历史</div>
              ) : (
                domains.map((domain) => (
                  <div key={domain} className={`history-item ${domain === currentDomain ? "active" : ""}`}>
                    <div className="history-item-main" onClick={() => handleSwitchDomain(domain)}>
                      <span className="history-domain">{domain}</span>
                      <button
                        className="history-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`确定要删除 ${domain} 的对话历史吗？`)) {
                            deleteConversation(domain);
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
            <div className="history-panel-footer">
              <button
                className="clear-btn"
                onClick={() => {
                  if (confirm(`确定要清空当前域名 ${currentDomain} 的对话吗？`)) {
                    clearCurrentConversation();
                  }
                }}
              >
                清空当前对话
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ConfigProvider locale={getLocale()}>
      <SidePanelContent />
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  process.env.NODE_ENV === "development" ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
);
