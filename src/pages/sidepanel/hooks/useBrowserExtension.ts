export const useBrowserExtension = () => {
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

  return {
    refreshCurrentPage,
    copyToClipboard,
    executeCode,
    injectExecutionService,
  };
};
