import React from "react";
import type { Message } from "../types";
import { parseElementRefs } from "../utils/messageUtils";

interface MessageRendererProps {
  message: Message;
  selectedElements: any[];
  selectedMessages: Set<string>;
  expandedMessages: Set<string>;
  toggleMessageSelection: (id: string) => void;
  toggleExpandedMessages: (id: string) => void;
  onRunCode: (code: string) => void;
  onSaveCode: (code: string) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  message,
  selectedElements,
  selectedMessages,
  expandedMessages,
  toggleMessageSelection,
  toggleExpandedMessages,
  onRunCode,
  onSaveCode,
}) => {
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
    <div key={message.id} className={`ai-message ${message.role}`}>
      <div
        className={`message-checkbox ${selectedMessages.has(message.id) ? "checked" : ""}`}
        onClick={() => toggleMessageSelection(message.id)}
      >
        <input type="checkbox" checked={selectedMessages.has(message.id)} readOnly />
      </div>
      {message.role === "assistant" && message.codeBlocks && message.codeBlocks.length > 0 && (
        <div
          className={`debug-toggle ${expandedMessages.has(message.id) ? "expanded" : ""}`}
          onClick={() => toggleExpandedMessages(message.id)}
        >
          {expandedMessages.has(message.id) ? "▼" : "▶"}
        </div>
      )}
      <div className="ai-message-content">
        {message.role === "user" ? (
          renderMessageContent(message.content)
        ) : (
          <div className="message-text">
            {message.content.split(/(```javascript[\s\S]*?```)/g).map((part, index) => {
              if (part.startsWith("```javascript") && part.endsWith("```")) {
                const code = part.slice(14, -3);
                const codeBlock = message.codeBlocks?.[Math.floor(index / 2)];
                return (
                  <div key={index} className="code-block">
                    <pre>
                      <code>{code}</code>
                    </pre>
                    <div className="code-actions">
                      <button className="run-btn" onClick={() => codeBlock && onRunCode(codeBlock.code)}>
                        运行
                      </button>
                      <button className="save-btn" onClick={() => codeBlock && onSaveCode(codeBlock.code)}>
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
      {message.role === "assistant" && expandedMessages.has(message.id) && (
        <div className="debug-panel">
          <div className={`debug-section ${expandedMessages.has(message.id) ? "expanded" : ""}`}>
            <div className="debug-header">
              <span className="debug-title">Request</span>
              <button
                className="copy-btn"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(message.request, null, 2))}
              >
                复制
              </button>
            </div>
            <pre className="debug-content">{JSON.stringify(message.request, null, 2)}</pre>
          </div>
          <div className={`debug-section ${expandedMessages.has(message.id) ? "expanded" : ""}`}>
            <div className="debug-header">
              <span className="debug-title">Response</span>
              <button
                className="copy-btn"
                onClick={() => {
                  const responseText =
                    typeof message.response === "object" && "text" in message.response
                      ? (message.response as any).text
                      : JSON.stringify(message.response, null, 2);
                  navigator.clipboard.writeText(responseText);
                }}
              >
                复制
              </button>
            </div>
            <pre className="debug-content">
              {typeof message.response === "object" && "text" in message.response
                ? (message.response as any).text
                : JSON.stringify(message.response, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
