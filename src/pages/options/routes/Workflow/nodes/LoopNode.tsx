import React from "react";
import { useTranslation } from "react-i18next";
import { IconLoop } from "@arco-design/web-react/icon";

const LoopNode: React.FC<{ node: any }> = ({ node }) => {
  const { t } = useTranslation();
  const arrayPath = node.data?.arrayPath;

  return (
    <div className="flex flex-col gap-1 px-4 py-2 bg-purple-500 text-white rounded-lg shadow-md min-w-32">
      <div className="flex items-center gap-2">
        <IconLoop />
        <span className="font-medium">{node.data?.name || t("workflow_page.node_loop")}</span>
      </div>
      {arrayPath && <span className="text-xs opacity-80 truncate">{arrayPath}</span>}
    </div>
  );
};

export default LoopNode;
