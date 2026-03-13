import React from "react";
import { useTranslation } from "react-i18next";
import { IconStorage } from "@arco-design/web-react/icon";

const VariableNode: React.FC<{ node: any }> = ({ node }) => {
  const { t } = useTranslation();
  const variables = node.data?.variables || {};
  const varCount = Object.keys(variables).length;

  return (
    <div className="flex flex-col gap-1 px-4 py-2 bg-cyan-500 text-white rounded-lg shadow-md min-w-32">
      <div className="flex items-center gap-2">
        <IconStorage />
        <span className="font-medium">{node.data?.name || t("workflow_page.node_variable")}</span>
      </div>
      {varCount > 0 && (
        <span className="text-xs opacity-80">
          {varCount} {t("workflow_page.variables")}
        </span>
      )}
    </div>
  );
};

export default VariableNode;
