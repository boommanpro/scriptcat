const selectionState = {
  isSelecting: false,
  selectedElements: [],
  highlightOverlay: null,
  tooltipElement: null,
};

function createHighlightOverlay() {
  if (selectionState.highlightOverlay) {
    return selectionState.highlightOverlay;
  }

  const overlay = document.createElement("div");
  overlay.id = "ai-selection-highlight-overlay";
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    transition: all 0.1s ease-out;
  `;

  const box = document.createElement("div");
  box.id = "ai-selection-highlight-box";
  box.style.cssText = `
    position: absolute;
    border: 2px solid #1890ff;
    background: rgba(24, 144, 255, 0.15);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
    pointer-events: none;
    transition: all 0.1s ease-out;
  `;

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
  tooltip.style.cssText = `
    position: fixed;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 2147483647;
    pointer-events: none;
    white-space: nowrap;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  `;

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

  box.style.left = `${rect.left + scrollX - 2}px`;
  box.style.top = `${rect.top + scrollY - 2}px`;
  box.style.width = `${rect.width + 4}px`;
  box.style.height = `${rect.height + 4}px`;
  overlay.style.display = "block";
}

function showTooltip(element, tooltip) {
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  const selector = getElementSelector(element);
  const tagName = element.tagName.toLowerCase();

  tooltip.textContent = `${tagName} ${selector}`;
  tooltip.style.left = `${rect.left + scrollX}px`;
  tooltip.style.top = `${rect.top + scrollY - 28}px`;
  tooltip.style.display = "block";
}

function hideHighlight(overlay) {
  overlay.style.display = "none";
}

function hideTooltip(tooltip) {
  tooltip.style.display = "none";
}

function getElementSelector(element) {
  if (element.id && element.id.match(/^[a-zA-Z_][a-zA-Z0-9_\-]*$/) && document.getElementById(element.id) === element) {
    return `#${element.id}`;
  }

  let selector = element.tagName.toLowerCase();

  if (element.className && typeof element.className === "string") {
    const classes = element.className
      .trim()
      .split(/\s+/)
      .filter((c) => c && c.match(/^[a-zA-Z_][a-zA-Z0-9_\-]*$/));
    if (classes.length > 0) {
      selector += "." + classes.slice(0, 3).join(".");
    }
  }

  if (element.getAttribute("name")) {
    selector += `[name="${element.getAttribute("name")}"]`;
  }

  if (element.getAttribute("type")) {
    selector += `[type="${element.getAttribute("type")}"]`;
  }

  if (element.getAttribute("href")) {
    const href = element.getAttribute("href");
    if (href && href.length > 20) {
      selector += `[href^="${href.substring(0, 20)}..."]`;
    } else {
      selector += `[href="${href}"]`;
    }
  }

  if (element.getAttribute("aria-label")) {
    selector += `[aria-label="${element.getAttribute("aria-label")}"]`;
  }

  if (element.getAttribute("placeholder")) {
    selector += `[placeholder="${element.getAttribute("placeholder")}"]`;
  }

  return selector;
}

function getElementInfo(element) {
  const tagName = element.tagName.toLowerCase();
  const selector = getElementSelector(element);
  const textContent = element.textContent?.trim().slice(0, 100) || "";
  const outerHTML = element.outerHTML.slice(0, 300);

  let href = null;
  if (element.tagName.toLowerCase() === "a" && element.getAttribute("href")) {
    href = element.getAttribute("href");
  } else if (element.querySelector) {
    const link = element.querySelector("a[href]");
    if (link) {
      href = link.getAttribute("href");
    }
  }

  let src = null;
  if (element.tagName.toLowerCase() === "img" && element.getAttribute("src")) {
    src = element.getAttribute("src");
  } else if (element.querySelector) {
    const img = element.querySelector("img[src]");
    if (img) {
      src = img.getAttribute("src");
    }
  }

  return {
    tagName,
    selector,
    textContent,
    outerHTML,
    href,
    src,
    id: element.id || null,
    className: element.className?.toString().slice(0, 100) || null,
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

function handleMouseOut(event) {
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
  info.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 16px;">
      <span style="width: 12px; height: 12px; background: #1890ff; border-radius: 50%; animation: ai-pulse 1.5s infinite;"></span>
      <span>点击选择元素</span>
    </div>
    <style>
      @keyframes ai-pulse {
        0% { box-shadow: 0 0 0 0 rgba(24, 144, 255, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(24, 144, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(24, 144, 255, 0); }
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

  const overlay = createHighlightOverlay();
  hideHighlight(overlay);
}

function stopSelection() {
  if (!selectionState.isSelecting) return;

  selectionState.isSelecting = false;

  document.removeEventListener("click", handleElementClick, true);
  document.removeEventListener("mouseover", handleMouseOver, true);
  document.removeEventListener("mouseout", handleMouseOut, true);

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

  const info = document.getElementById("ai-selection-info");
  if (info) {
    info.remove();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_ELEMENT_SELECTION") {
    startSelection();
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
