// 网络监控 Content Script - 在 isolated world 中运行
// 作为桥梁，从 MAIN world 获取数据并发送到 Service Worker

(function () {
  "use strict";

  console.log("[Network Monitor Bridge] Content script loaded in isolated world");

  // 定期从 MAIN world 获取数据并发送到 Service Worker
  setInterval(async () => {
    try {
      // 通过 executeScript 从 MAIN world 读取数据
      // 注意：这里不能直接访问，需要通过其他方式
      // 实际上，我们需要让 MAIN world 的脚本通过 window.postMessage 发送数据
    } catch (error) {
      // 忽略错误
    }
  }, 500);

  // 监听来自 MAIN world 的消息（通过 window.postMessage）
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.source === "network-monitor-main") {
      // 转发到 Service Worker
      try {
        chrome.runtime
          .sendMessage({
            type: event.data.type,
            data: event.data.data,
          })
          .catch(() => {});
      } catch (error) {
        // 扩展上下文已失效，忽略错误
        console.log("[Network Monitor Bridge] Extension context invalidated, stopping message forwarding");
      }
    }
  });
})();
