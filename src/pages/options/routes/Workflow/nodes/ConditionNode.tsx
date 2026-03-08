import React from "react";
import { useTranslation } from "react-i18next";
import { IconBranch } from "@arco-design/web-react/icon";

const ConditionNode: React.FC<{ node: any }> = ({ node }) => {
  const { t } = useTranslation();
  const conditions = node.data?.conditions || [];

  return (
    <div className="flex flex-col gap-1 px-4 py-2 bg-yellow-500 text-white rounded-lg shadow-md min-w-32">
      <div className="flex items-center gap-2">
        <IconBranch />
        <span className="font-medium">{node.data?.name || t("workflow_page.node_condition")}</span>
      </div>
      {conditions.length > 0 && (
        <span className="text-xs opacity-80">
          {conditions.length} {t("workflow_page.conditions")}
        </span>
      )}
    </div>
  );
};

export default ConditionNode;
