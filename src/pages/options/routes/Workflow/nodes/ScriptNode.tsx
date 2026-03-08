import React from "react";
import { useTranslation } from "react-i18next";
import { IconCode } from "@arco-design/web-react/icon";

const ScriptNode: React.FC<{ node: any }> = ({ node }) => {
  const { t } = useTranslation();
  const scriptKey = node.data?.scriptKey;

  return (
    <div className="flex flex-col gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md min-w-32">
      <div className="flex items-center gap-2">
        <IconCode />
        <span className="font-medium">{node.data?.name || t("workflow_page.node_script")}</span>
      </div>
      {scriptKey && <span className="text-xs opacity-80 truncate">{scriptKey}</span>}
    </div>
  );
};

export default ScriptNode;
