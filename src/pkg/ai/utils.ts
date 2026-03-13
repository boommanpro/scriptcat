import type { CodeBlock } from "./types";

export const extractCodeBlocks = (content: string): CodeBlock[] => {
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

export const parseElementRefs = (content: string, elements: any[]) => {
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

export const replaceElementRefs = (content: string, elements: any[]) => {
  return content.replace(/\[(\d+)\]/g, (_, num) => {
    const idx = parseInt(num, 10) - 1;
    if (idx >= 0 && idx < elements.length) {
      const el = elements[idx];
      return `[元素${num}] 选择器: ${el.selector}\n源代码: ${el.outerHTML || ""}`;
    }
    return `[${num}]`;
  });
};

export const formatElementRef = (element: any, index: number) => {
  return `### [${index + 1}] 元素引用
**选择器**: \`${element.selector}\`
**源代码**:
\`\`\`html
${element.outerHTML || ""}
\`\`\`
`;
};
