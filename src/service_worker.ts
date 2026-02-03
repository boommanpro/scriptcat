import ServiceWorkerManager from "./app/service/service_worker";
import LoggerCore from "./app/logger/core";
import DBWriter from "./app/logger/db_writer";
import { LoggerDAO } from "./app/repo/logger";
import { ExtensionMessage } from "@Packages/message/extension_message";
import { Server } from "@Packages/message/server";
import { MessageQueue } from "@Packages/message/message_queue";
import { ServiceWorkerMessageSend } from "@Packages/message/window_message";
import migrate, { migrateChromeStorage } from "./app/migrate";
import { fetchIconByDomain } from "./app/service/service_worker/fetch";
import { msgResponse } from "./app/service/service_worker/utils";
import type { RuntimeMessageSender } from "@Packages/message/types";
import { cleanInvalidKeys } from "./app/repo/resource";

migrate();
migrateChromeStorage();

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen.html";

let creating: Promise<void> | null | boolean = null;

async function hasDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl],
  });
  return existingContexts.length > 0;
}

async function setupOffscreenDocument() {
  if (typeof chrome.offscreen?.createDocument !== "function") {
    // Firefox does not support offscreen
    console.error("Your browser does not support chrome.offscreen.createDocument");
    return;
  }
  //if we do not have a document, we are already setup and can skip
  if (!(await hasDocument())) {
    // create offscreen document
    if (!creating) {
      const promise = chrome.offscreen
        .createDocument({
          url: OFFSCREEN_DOCUMENT_PATH,
          reasons: [
            chrome.offscreen.Reason.BLOBS,
            chrome.offscreen.Reason.CLIPBOARD,
            chrome.offscreen.Reason.DOM_SCRAPING,
            chrome.offscreen.Reason.LOCAL_STORAGE,
          ],
          justification: "offscreen page",
        })
        .then(() => {
          if (creating !== promise) {
            console.log("setupOffscreenDocument() calling is invalid.");
            return;
          }
          creating = true; // chrome.offscreen.createDocument 只执行一次
        });
      creating = promise;
    }
    await creating;
  }
}

function main() {
  cleanInvalidKeys();
  // 初始化管理器
  const message = new ExtensionMessage(true);
  // 初始化日志组件
  const loggerCore = new LoggerCore({
    writer: new DBWriter(new LoggerDAO()),
    labels: { env: "service_worker" },
  });
  loggerCore.logger().debug("service worker start");
  const server = new Server("serviceWorker", message);
  const messageQueue = new MessageQueue();
  const manager = new ServiceWorkerManager(server, messageQueue, new ServiceWorkerMessageSend());
  manager.initManager();
  // 初始化沙盒环境
  setupOffscreenDocument();
}

const apiActions: {
  [key: string]: (message: any, _sender: RuntimeMessageSender) => Promise<any> | any;
} = {
  async "fetch-icon-by-domain"(message: any, _sender: RuntimeMessageSender) {
    const { domain } = message;
    return await fetchIconByDomain(domain);
  },
  async "ai-start-selection"(message: any, _sender: RuntimeMessageSender) {
    const { tabId } = message;
    if (!tabId) return { success: false, error: "No tabId" };

    const selectionScript = function () {
      const selectionState = {
        isSelecting: false,
        selectedElements: [],
        highlightOverlay: null,
        tooltipElement: null,
        highlightUpdater: null, // 高亮更新定时器
      };

      function createHighlightOverlay() {
        if (selectionState.highlightOverlay) {
          return selectionState.highlightOverlay;
        }

        const overlay = document.createElement("div");
        overlay.id = "ai-selection-highlight-overlay";
        overlay.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;transition:all 0.15s ease-out;";

        const box = document.createElement("div");
        box.id = "ai-selection-highlight-box";
        box.style.cssText =
          "position:absolute;border:2px solid #1a73e8;background:rgba(26,115,232,0.1);box-shadow:0 0 0 1px rgba(26,115,232,0.3),inset 0 0 0 1px rgba(26,115,232,0.1);pointer-events:none;transition:all 0.15s ease-out;outline:1px solid rgba(26,115,232,0.2);";

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        selectionState.highlightOverlay = overlay;
        return overlay;
      }

      function createTooltip() {
        if (selectionState.tooltipElement) {
          return selectionState.tooltipElement;
        }

        const tooltip = document.createElement("div");
        tooltip.id = "ai-selection-tooltip";
        tooltip.style.cssText =
          "position:fixed;padding:6px 10px;background:rgba(0,0,0,0.85);color:white;border-radius:4px;font-size:12px;font-family:system-ui,-apple-system,sans-serif;z-index:2147483647;pointer-events:none;white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.3);";

        document.body.appendChild(tooltip);
        selectionState.tooltipElement = tooltip;
        return tooltip;
      }

      function showHighlight(element, overlay) {
        const box = overlay.querySelector("#ai-selection-highlight-box");
        if (!box) return;

        const rect = element.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        box.style.left = rect.left + scrollX - 2 + "px";
        box.style.top = rect.top + scrollY - 2 + "px";
        box.style.width = rect.width + 4 + "px";
        box.style.height = rect.height + 4 + "px";
        overlay.style.display = "block";
      }

      function showTooltip(element, tooltip) {
        const rect = element.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        const tagName = element.tagName.toLowerCase();
        let selector = tagName;

        if (
          element.id &&
          element.id.match(/^[a-zA-Z_][a-zA-Z0-9_\\-]*$/) &&
          document.getElementById(element.id) === element
        ) {
          selector = "#" + element.id;
        } else {
          if (element.className && typeof element.className === "string") {
            const classes = element.className
              .trim()
              .split(/\\s+/)
              .filter(function (c) {
                return c && c.match(/^[a-zA-Z_][a-zA-Z0-9_\\-]*$/);
              });
            if (classes.length > 0) {
              selector += "." + classes.slice(0, 3).join(".");
            }
          }
          if (element.getAttribute && element.getAttribute("name")) {
            selector += '[name="' + element.getAttribute("name") + '"]';
          }
          if (element.getAttribute && element.getAttribute("type")) {
            selector += '[type="' + element.getAttribute("type") + '"]';
          }
        }

        tooltip.textContent = selector;
        tooltip.style.left = rect.left + scrollX + "px";
        tooltip.style.top = rect.top + scrollY - 28 + "px";
        tooltip.style.display = "block";
      }

      function hideHighlight(overlay) {
        overlay.style.display = "none";
      }

      function hideTooltip(tooltip) {
        tooltip.style.display = "none";
      }

      function getElementInfo(element) {
        const tagName = element.tagName.toLowerCase();
        let selector = tagName;

        if (
          element.id &&
          element.id.match(/^[a-zA-Z_][a-zA-Z0-9_\\-]*$/) &&
          document.getElementById(element.id) === element
        ) {
          selector = "#" + element.id;
        } else {
          if (element.className && typeof element.className === "string") {
            const classes = element.className
              .trim()
              .split(/\\s+/)
              .filter(function (c) {
                return c && c.match(/^[a-zA-Z_][a-zA-Z0-9_\\-]*$/);
              });
            if (classes.length > 0) {
              selector += "." + classes.slice(0, 3).join(".");
            }
          }
          if (element.getAttribute && element.getAttribute("name")) {
            selector += '[name="' + element.getAttribute("name") + '"]';
          }
        }

        const textContent = element.textContent ? element.textContent.trim().slice(0, 100) : "";
        const outerHTML = element.outerHTML ? element.outerHTML.slice(0, 300) : "";

        return {
          tagName: tagName,
          selector: selector,
          textContent: textContent,
          outerHTML: outerHTML,
        };
      }

      function handleElementClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const element = event.target;
        const elementInfo = getElementInfo(element);

        selectionState.selectedElements = [elementInfo];

        chrome.runtime.sendMessage({
          type: "ELEMENT_SELECTED",
          elements: selectionState.selectedElements,
        });

        stopSelection();
      }

      function handleMouseOver(event) {
        if (!selectionState.isSelecting) return;

        const overlay = createHighlightOverlay();
        const tooltip = createTooltip();
        const element = event.target;

        showHighlight(element, overlay);
        showTooltip(element, tooltip);
      }

      function handleMouseOut(_event: any) {
        const overlay = selectionState.highlightOverlay;
        const tooltip = selectionState.tooltipElement;

        if (overlay) {
          hideHighlight(overlay);
        }
        if (tooltip) {
          hideTooltip(tooltip);
        }
      }

      function startSelection() {
        if (selectionState.isSelecting) return;

        selectionState.isSelecting = true;
        selectionState.selectedElements = [];

        document.addEventListener("click", handleElementClick, true);
        document.addEventListener("mouseover", handleMouseOver, true);
        document.addEventListener("mouseout", handleMouseOut, true);

        document.body.style.cursor = "crosshair";

        const overlay = createHighlightOverlay();
        const tooltip = createTooltip();
        hideHighlight(overlay);
        hideTooltip(tooltip);

        const info = document.createElement("div");
        info.id = "ai-selection-info";
        info.style.cssText =
          "position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);color:white;border-radius:20px;font-size:14px;z-index:2147483647;pointer-events:none;display:flex;align-items:center;padding:8px 16px;";
        info.innerHTML =
          '<span style="width:12px;height:12px;background:#1890ff;border-radius:50%;display:inline-block;margin-right:8px;"></span><span>点击选择元素</span>';
        document.body.appendChild(info);
      }

      function getElementSelector(element) {
        if (
          element.id &&
          element.id.match(/^[a-zA-Z_][a-zA-Z0-9_\\-]*$/) &&
          document.getElementById(element.id) === element
        ) {
          return "#" + element.id;
        } else {
          let selector = element.tagName.toLowerCase();
          if (element.className && typeof element.className === "string") {
            const classes = element.className
              .trim()
              .split(/\\s+/)
              .filter(function (c) {
                return c && c.match(/^[a-zA-Z_][a-zA-Z0-9_\\-]*$/);
              });
            if (classes.length > 0) {
              selector += "." + classes.slice(0, 3).join(".");
            }
          }
          if (element.getAttribute && element.getAttribute("name")) {
            selector += '[name="' + element.getAttribute("name") + '"]';
          }
          if (element.getAttribute && element.getAttribute("type")) {
            selector += '[type="' + element.getAttribute("type") + '"]';
          }
          return selector;
        }
      }

      function startVisualSelection() {
        if (selectionState.isSelecting) return;

        selectionState.isSelecting = true;
        selectionState.selectedElements = [];

        // 移除之前可能存在的所有高亮
        removeVisualHighlights();

        // 为页面上所有可见元素添加视觉高亮
        addVisualHighlights();

        // 添加点击事件监听器
        document.addEventListener("click", handleVisualElementClick, true);

        document.body.style.cursor = "crosshair";

        // 显示提示信息
        const info = document.createElement("div");
        info.id = "ai-selection-info";
        info.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; padding: 8px 16px;">
            <span style="width: 12px; height: 12px; background: #52c41a; border-radius: 50%; animation: ai-pulse 1.5s infinite;"></span>
            <span>点击任意高亮元素进行选择</span>
          </div>
          <style>
            @keyframes ai-pulse {
              0% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); }
              70% { box-shadow: 0 0 0 10px rgba(82, 196, 26, 0); }
              100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
            }
          </style>
        `;
        info.style.cssText = `
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          border-radius: 20px;
          font-size: 14px;
          z-index: 2147483647;
          pointer-events: none;
          display: flex;
          align-items: center;
        `;
        document.body.appendChild(info);
      }

      function addVisualHighlights() {
        // 获取所有可见元素
        const allElements = document.querySelectorAll("*");
        const visibleElements = [];

        for (const element of allElements) {
          // 过滤掉一些不需要高亮的元素
          if (shouldHighlightElement(element)) {
            visibleElements.push(element);

            // 为元素添加高亮边框
            const highlight = document.createElement("div");
            highlight.className = "ai-visual-highlight";
            highlight.style.position = "absolute";
            highlight.style.border = "2px dashed #52c41a";
            highlight.style.backgroundColor = "rgba(82, 196, 26, 0.1)";
            highlight.style.pointerEvents = "none";
            highlight.style.zIndex = "2147483646";
            highlight.style.transition = "all 0.1s ease";

            // 绑定元素到高亮div
            highlight.__highlightedElement = element;

            document.body.appendChild(highlight);

            // 更新高亮位置
            updateHighlightPosition(highlight, element);

            // 添加鼠标悬停效果
            element.addEventListener("mouseenter", () => {
              if (!selectionState.isSelecting) return;
              highlight.style.border = "2px solid #faad14";
              highlight.style.backgroundColor = "rgba(250, 173, 20, 0.2)";

              // 显示元素信息
              const tooltip = createTooltip();
              const selector = getElementSelector(element);
              const tagName = element.tagName.toLowerCase();
              tooltip.textContent = `${tagName} ${selector}`;

              const rect = element.getBoundingClientRect();
              const scrollX = window.scrollX || window.pageXOffset;
              const scrollY = window.scrollY || window.pageYOffset;

              tooltip.style.left = `${rect.left + scrollX}px`;
              tooltip.style.top = `${rect.top + scrollY - 28}px`;
              tooltip.style.display = "block";
            });

            element.addEventListener("mouseleave", () => {
              if (!selectionState.isSelecting) return;
              highlight.style.border = "2px dashed #52c41a";
              highlight.style.backgroundColor = "rgba(82, 196, 26, 0.1)";

              const tooltip = selectionState.tooltipElement;
              if (tooltip) {
                tooltip.style.display = "none";
              }
            });
          }
        }

        // 每200毫秒更新一次高亮位置，适应页面滚动等变化
        selectionState.highlightUpdater = setInterval(() => {
          const highlights = document.querySelectorAll(".ai-visual-highlight");
          highlights.forEach((highlight) => {
            const element = highlight.__highlightedElement;
            if (element) {
              updateHighlightPosition(highlight, element);
            }
          });
        }, 200);
      }

      function updateHighlightPosition(highlight, element) {
        const rect = element.getBoundingClientRect();

        // 检查元素是否在视口中以及是否可见
        if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
          highlight.style.display = "none";
          return;
        }

        highlight.style.display = "block";
        highlight.style.left = rect.left + (window.scrollX || window.pageXOffset) + "px";
        highlight.style.top = rect.top + (window.scrollY || window.pageYOffset) + "px";
        highlight.style.width = rect.width + "px";
        highlight.style.height = rect.height + "px";
      }

      function removeVisualHighlights() {
        // 清除高亮更新定时器
        if (selectionState.highlightUpdater) {
          clearInterval(selectionState.highlightUpdater);
          selectionState.highlightUpdater = null;
        }

        // 移除所有高亮元素
        const highlights = document.querySelectorAll(".ai-visual-highlight");
        highlights.forEach((highlight) => highlight.remove());

        // 移除提示信息
        const info = document.getElementById("ai-selection-info");
        if (info) {
          info.remove();
        }
      }

      function shouldHighlightElement(element) {
        // 不高亮的元素类型
        const excludeTags = ["SCRIPT", "STYLE", "META", "LINK", "TITLE", "NOSCRIPT"];
        if (excludeTags.includes(element.tagName)) return false;

        // 不高亮隐藏元素
        const computedStyle = window.getComputedStyle(element);
        if (
          computedStyle.display === "none" ||
          computedStyle.visibility === "hidden" ||
          computedStyle.opacity === "0"
        ) {
          return false;
        }

        // 不高亮尺寸为0的元素
        const rect = element.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;

        // 不高亮非常小的元素（小于4x4像素）
        if (rect.width * rect.height < 16) return false;

        // 检查是否在视口内
        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
          return false;
        }

        return true;
      }

      function handleVisualElementClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const element = event.target;
        const elementInfo = getElementInfo(element);

        // 将选中的元素信息添加到选中列表
        selectionState.selectedElements = [elementInfo];

        chrome.runtime.sendMessage({
          type: "ELEMENT_SELECTED",
          elements: selectionState.selectedElements,
        });

        stopSelection();
      }

      // 为自定义属性添加类型扩展
      const extendElement = (element, property, value) => {
        element[property] = value;
      };

      const getElementProperty = (element, property) => {
        return element[property];
      };

      function stopSelection() {
        if (!selectionState.isSelecting) return;

        selectionState.isSelecting = false;

        document.removeEventListener("click", handleElementClick, true);
        document.removeEventListener("mouseover", handleMouseOver, true);
        document.removeEventListener("mouseout", handleMouseOut, true);
        document.removeEventListener("click", handleVisualElementClick, true);

        document.body.style.cursor = "";

        const overlay = selectionState.highlightOverlay;
        if (overlay) {
          overlay.remove();
          selectionState.highlightOverlay = null;
        }

        const tooltip = selectionState.tooltipElement;
        if (tooltip) {
          tooltip.remove();
          selectionState.tooltipElement = null;
        }

        // 清除视觉高亮
        removeVisualHighlights();

        const info = document.getElementById("ai-selection-info");
        if (info) {
          info.remove();
        }
      }

      chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        if (message.type === "START_ELEMENT_SELECTION") {
          startSelection();
          sendResponse({ success: true });
        } else if (message.type === "START_VISUAL_SELECTION") {
          startVisualSelection();
          sendResponse({ success: true });
        } else if (message.type === "STOP_ELEMENT_SELECTION") {
          stopSelection();
          sendResponse({ success: true });
        } else if (message.type === "CLEAR_SELECTION") {
          selectionState.selectedElements = [];
          sendResponse({ success: true });
        }
        return true;
      });
    };

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: selectionScript,
      });

      // 根据模式决定发送哪种消息
      const mode = message.mode || "normal"; // 默认为普通模式
      if (mode === "visual") {
        await chrome.tabs.sendMessage(tabId, { type: "START_VISUAL_SELECTION" });
      } else {
        await chrome.tabs.sendMessage(tabId, { type: "START_ELEMENT_SELECTION" });
      }
      return { success: true };
    } catch (error: any) {
      console.error("Failed to start selection:", error);
      return { success: false, error: error.message };
    }
  },
  async "ai-stop-selection"(message: any, _sender: RuntimeMessageSender) {
    const { tabId } = message;
    if (!tabId) return { success: false, error: "No tabId" };

    try {
      await chrome.tabs.sendMessage(tabId, { type: "STOP_ELEMENT_SELECTION" });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  async "ai-execute-code"(message: any, _sender: RuntimeMessageSender) {
    const { tabId, code } = message;
    if (!tabId) return { success: false, error: "No tabId" };

    const executionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    console.log("[ServiceWorker] ai-execute-code called", {
      tabId,
      executionId,
      codePreview: code.substring(0, 50) + "...",
    });

    try {
      console.log("[ServiceWorker] Sending message to tab:", tabId);
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "ai-code-executor",
        code,
        executionId,
      });

      console.log("[ServiceWorker] Received response from tab:", response);
      if (response && response.executionId === executionId) {
        console.log("[ServiceWorker] Execution successful via direct message");
        return {
          success: response.success,
          result: response.result,
          error: response.error,
        };
      } else {
        console.warn("[ServiceWorker] Response executionId mismatch or invalid response", {
          expected: executionId,
          received: response?.executionId,
        });
      }
    } catch (error: any) {
      console.log("[ServiceWorker] Direct execution failed, falling back to injected script:", error.message);
    }

    console.log("[ServiceWorker] Using fallback executeScript method with MAIN world");
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (scriptCode) => {
          console.log("[Page-Fallback] Executing code in MAIN world:", scriptCode.substring(0, 50) + "...");
          try {
            const func = new Function(scriptCode);
            const result = func();
            console.log("[Page-Fallback] Execution success:", result);
            return { success: true, result: String(result) };
          } catch (error: any) {
            console.error("[Page-Fallback] Execution failed:", error);
            return { success: false, error: String(error) };
          }
        },
        args: [code],
      });
      return result[0]?.result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  const f = apiActions[req.message ?? ""];
  if (f) {
    let res;
    try {
      res = f(req, sender);
    } catch (e: any) {
      sendResponse(msgResponse(1, e));
      return false;
    }
    if (typeof res?.then === "function") {
      res.then(sendResponse).catch((e: Error) => {
        sendResponse(msgResponse(1, e));
      });
      return true;
    } else {
      sendResponse(msgResponse(0, res));
      return false;
    }
  }

  if (req.type === "ELEMENT_SELECTED" && sender.tab?.id) {
    chrome.runtime
      .sendMessage({
        message: "ai-element-selected",
        data: {
          tabId: sender.tab.id,
          elements: req.elements,
        },
      })
      .catch(() => { });
  }

  return false;
});

main();
