import React from "react";
import { useTranslation } from "react-i18next";
import { IconPlayCircle } from "@arco-design/web-react/icon";

const StartNode: React.FC<{ node: any }> = ({ node }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg shadow-md min-w-24">
      <IconPlayCircle />
      <span className="font-medium">{node.data?.name || t("workflow_page.node_start")}</span>
    </div>
  );
};

export default StartNode;
