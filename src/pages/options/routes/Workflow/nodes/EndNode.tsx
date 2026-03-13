import React from "react";
import { useTranslation } from "react-i18next";
import { IconCloseCircle } from "@arco-design/web-react/icon";

const EndNode: React.FC<{ node: any }> = ({ node }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg shadow-md min-w-24">
      <IconCloseCircle />
      <span className="font-medium">{node.data?.name || t("workflow_page.node_end")}</span>
    </div>
  );
};

export default EndNode;
