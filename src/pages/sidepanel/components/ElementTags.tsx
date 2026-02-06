import React from "react";

interface ElementTagsProps {
  selectedElements: any[];
  onInsertAll: () => void;
  onInsertElement: (element: any, index: number) => void;
  onRemoveElement: (index: number) => void;
}

export const ElementTags: React.FC<ElementTagsProps> = ({
  selectedElements,
  onInsertAll,
  onInsertElement,
  onRemoveElement,
}) => {
  if (selectedElements.length === 0) return null;

  return (
    <div className="element-tags">
      <div className="element-tags-header">
        <button className="insert-all-btn" onClick={onInsertAll}>
          插入全部
        </button>
      </div>
      <div className="element-tags-list">
        {selectedElements.map((el, index) => (
          <div key={index} className="element-tag">
            <span className="element-tag-text" title={el.selector}>
              {el.tagName}
            </span>
            <span className="element-tag-insert" onClick={() => onInsertElement(el, index)} title="插入到输入框">
              📥
            </span>
            <span className="element-tag-remove" onClick={() => onRemoveElement(index)}>
              ×
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
