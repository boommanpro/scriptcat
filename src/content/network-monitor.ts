// 网络监控 Content Script - 在 document_start 时注入
// 这个脚本运行在 isolated world，负责在 MAIN world 中注入监控代码

// 立即执行注入
(function () {
  'use strict';

  // 注入脚本到 MAIN world
  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('network-monitor-inject.js');
    script.onload = function () {
      // 脚本加载完成后移除
      script.remove();
    };

    // 在 documentElement 存在时立即注入
    if (document.documentElement) {
      document.documentElement.appendChild(script);
    } else {
      // 如果 documentElement 还不存在，等待它出现
      const observer = new MutationObserver(() => {
        if (document.documentElement) {
          observer.disconnect();
          document.documentElement.appendChild(script);
        }
      });
      observer.observe(document, { childList: true });
    }
  }

  // 立即注入
  injectScript();
})();
