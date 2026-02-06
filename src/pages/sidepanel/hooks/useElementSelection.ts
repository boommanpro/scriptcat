import { useState, useEffect } from "react";

export const useElementSelection = () => {
  const [selectedElements, setSelectedElements] = useState<any[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  const removeSelectedElement = (index: number) => {
    setSelectedElements((prev) => prev.filter((_, i) => i !== index));
  };

  const insertElementInfo = (element: any, index: number) => {
    const elementText = `### [${index + 1}] 元素引用
**选择器**: \`${element.selector}\`
**源代码**:
\`\`\`html
${element.outerHTML || ""}
\`\`\`
`;
    // 这里需要回调给父组件处理输入框更新
    return elementText;
  };

  const insertAllElements = () => {
    if (selectedElements.length === 0) return "";
    return selectedElements
      .map(
        (el, idx) =>
          `### [${idx + 1}] 元素引用
**选择器**: \`${el.selector}\`
**源代码**:
\`\`\`html
${el.outerHTML || ""}
\`\`\`
`
      )
      .join("");
  };

  return {
    selectedElements,
    setSelectedElements,
    isSelecting,
    setIsSelecting,
    removeSelectedElement,
    insertElementInfo,
    insertAllElements,
  };
};
