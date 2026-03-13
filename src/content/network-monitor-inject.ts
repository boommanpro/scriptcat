// 网络监控注入脚本 - 在 MAIN world 中运行
// 这个脚本会被注入到页面中，劫持 fetch 和 XMLHttpRequest

(function () {
  "use strict";

  // 检查是否已经注入
  if ((window as any).__networkMonitorInjected) {
    return;
  }

  // 标记为已注入
  (window as any).__networkMonitorInjected = true;
  (window as any).__networkMonitorEnabled = false; // 默认不启用，等待 SidePanel 启动
  (window as any).__networkMonitorData = [];

  // 保存原始方法
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  let requestIdCounter = 0;

  const generateId = () => `req-${++requestIdCounter}-${Date.now()}`;

  const addEntry = (type: string, data: any) => {
    if (!(window as any).__networkMonitorEnabled) return;
    if (!(window as any).__networkMonitorData) {
      (window as any).__networkMonitorData = [];
    }
    (window as any).__networkMonitorData.push({ type, data });
  };

  // 拦截 fetch
  window.fetch = async function (...args) {
    if (!(window as any).__networkMonitorEnabled) {
      return originalFetch.apply(this, args);
    }

    const [input, init] = args;
    const url = typeof input === "string" ? input : input.url;
    const method = (init?.method || "GET").toUpperCase();
    const requestId = generateId();
    const startTime = Date.now();

    // 记录请求信息
    addEntry("NETWORK_REQUEST", {
      id: requestId,
      url,
      method,
      requestHeaders: init?.headers || {},
      requestBody: init?.body ? String(init.body) : undefined,
      timestamp: startTime,
    });

    try {
      const response = await originalFetch.apply(this, args);
      const duration = Date.now() - startTime;

      // 克隆响应以读取 headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // 记录响应信息
      addEntry("NETWORK_RESPONSE", {
        id: requestId,
        status: response.status,
        statusText: response.statusText,
        responseHeaders,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      addEntry("NETWORK_RESPONSE", {
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

  // 拦截 XMLHttpRequest
  XMLHttpRequest.prototype.open = function (method: string, url: string, ...args: any[]) {
    (this as any).__chobitsuRequest = {
      method: method.toUpperCase(),
      url: url.toString(),
    };
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function (body?: any) {
    if (!(window as any).__networkMonitorEnabled || !(this as any).__chobitsuRequest) {
      return originalXHRSend.apply(this, [body]);
    }

    const requestId = generateId();
    const startTime = Date.now();
    const requestInfo = (this as any).__chobitsuRequest;

    // 记录请求信息
    addEntry("NETWORK_REQUEST", {
      id: requestId,
      url: requestInfo.url,
      method: requestInfo.method,
      requestHeaders: {},
      requestBody: body ? String(body) : undefined,
      timestamp: startTime,
    });

    const onLoad = () => {
      const duration = Date.now() - startTime;
      const responseHeaders: Record<string, string> = {};

      const headerString = this.getAllResponseHeaders();
      if (headerString) {
        headerString.split("\n").forEach((line) => {
          const [key, value] = line.split(": ");
          if (key && value) {
            responseHeaders[key.toLowerCase()] = value;
          }
        });
      }

      addEntry("NETWORK_RESPONSE", {
        id: requestId,
        status: this.status,
        statusText: this.statusText,
        responseHeaders,
        duration,
      });
    };

    const onError = () => {
      const duration = Date.now() - startTime;
      addEntry("NETWORK_RESPONSE", {
        id: requestId,
        status: 0,
        statusText: "Network Error",
        responseHeaders: {},
        duration,
        error: "XHR Error",
      });
    };

    this.addEventListener("load", onLoad);
    this.addEventListener("error", onError);
    this.addEventListener("timeout", onError);

    return originalXHRSend.apply(this, [body]);
  };

  console.log("[Network Monitor] Injected successfully");
})();
