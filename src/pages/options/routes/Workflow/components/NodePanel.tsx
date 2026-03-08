import React from "react";
import { useTranslation } from "react-i18next";
import { Typography } from "@arco-design/web-react";
import { IconPlus } from "@arco-design/web-react/icon";
import { nodeRegistry } from "../nodes/registry";

const { Title } = Typography;

interface NodePanelProps {
  onAddNode: (type: string) => void;
}

const NodePanel: React.FC<NodePanelProps> = ({ onAddNode }) => {
  const { t } = useTranslation();

  return (
    <div className="absolute left-2 top-2 w-48 bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-2 border-b border-gray-200">
        <Title heading={6} className="m-0">
          {t("workflow_page.add_node")}
        </Title>
      </div>
      <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
        {Object.entries(nodeRegistry).map(([type, config]) => (
          <div
            key={type}
            className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 transition-colors"
            style={{ borderLeft: `3px solid ${config.color || "#666"}` }}
            onClick={() => onAddNode(type)}
          >
            <IconPlus className="text-gray-400" />
            <span className="text-sm">{t(config.label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodePanel;
