// 网络监控注入脚本 - 在 MAIN world 中运行
// 这个脚本会被注入到页面中，劫持 fetch 和 XMLHttpRequest
// 所有请求都会被拦截，根据 __networkMonitorEnabled 状态决定是否记录

(function() {
  'use strict';

  // 检查是否已经注入
  if (window.__networkMonitorInjected) {
    return;
  }

  // 标记为已注入
  window.__networkMonitorInjected = true;
  window.__networkMonitorEnabled = false; // 默认不启用，等待 SidePanel 启动
  window.__networkMonitorData = [];

  // 保存原始方法
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  let requestIdCounter = 0;

  const generateId = () => 'req-' + (++requestIdCounter) + '-' + Date.now();

  // 发送数据到 isolated world 的 content script
  const sendToIsolated = (type, data) => {
    window.postMessage({
      source: 'network-monitor-main',
      type: type,
      data: data,
    }, '*');
  };

  // 保存请求到数组（仅在启用时）
  const saveRequest = (type, data) => {
    if (!window.__networkMonitorEnabled) return;
    if (!window.__networkMonitorData) {
      window.__networkMonitorData = [];
    }
    window.__networkMonitorData.push({ type, data });
    // 同时发送到 isolated world
    sendToIsolated(type, data);
  };

  // ==================== 拦截 fetch ====================
  window.fetch = async function(...args) {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    const requestId = generateId();
    const startTime = Date.now();

    // 记录请求信息
    const requestInfo = {
      id: requestId,
      url,
      method,
      requestHeaders: init?.headers || {},
      requestBody: init?.body ? String(init.body) : undefined,
      timestamp: startTime,
    };

    // 如果启用监控，保存请求信息
    saveRequest("NETWORK_REQUEST", requestInfo);

    try {
      const response = await originalFetch.apply(this, args);
      const duration = Date.now() - startTime;

      // 读取响应 headers
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // 如果启用监控，保存响应信息
      saveRequest("NETWORK_RESPONSE", {
        id: requestId,
        status: response.status,
        statusText: response.statusText,
        responseHeaders,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 如果启用监控，保存错误信息
      saveRequest("NETWORK_RESPONSE", {
        id: requestId,
        status: 0,
        statusText: "Network Error",
        responseHeaders: {},
        duration,
        error: String(error),
      });
      
      throw error;
    }
  };

  // ==================== 拦截 XMLHttpRequest ====================
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    // 保存请求信息到 XHR 对象
    this.__networkMonitorRequest = {
      method: method.toUpperCase(),
      url: url.toString(),
    };
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const requestId = generateId();
    const startTime = Date.now();
    const requestInfo = this.__networkMonitorRequest;

    // 如果启用监控，保存请求信息
    if (requestInfo && window.__networkMonitorEnabled) {
      saveRequest("NETWORK_REQUEST", {
        id: requestId,
        url: requestInfo.url,
        method: requestInfo.method,
        requestHeaders: {},
        requestBody: body ? String(body) : undefined,
        timestamp: startTime,
      });
    }

    // 设置响应监听
    const onLoad = () => {
      if (!window.__networkMonitorEnabled) return;
      
      const duration = Date.now() - startTime;
      const responseHeaders = {};

      const headerString = this.getAllResponseHeaders();
      if (headerString) {
        headerString.split('\n').forEach(line => {
          const parts = line.split(': ');
          if (parts.length >= 2) {
            responseHeaders[parts[0].toLowerCase()] = parts.slice(1).join(': ');
          }
        });
      }

      saveRequest("NETWORK_RESPONSE", {
        id: requestId,
        status: this.status,
        statusText: this.statusText,
        responseHeaders,
        duration,
      });
    };

    const onError = () => {
      if (!window.__networkMonitorEnabled) return;
      
      const duration = Date.now() - startTime;
      saveRequest("NETWORK_RESPONSE", {
        id: requestId,
        status: 0,
        statusText: "Network Error",
        responseHeaders: {},
        duration,
        error: "XHR Error",
      });
    };

    this.addEventListener('load', onLoad);
    this.addEventListener('error', onError);
    this.addEventListener('timeout', onError);

    return originalXHRSend.apply(this, [body]);
  };

  console.log("[Network Monitor] Injected successfully - All fetch/XHR requests are now intercepted");
})();
