import "reflect-metadata";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  FreeLayoutEditor,
  WorkflowNodeRenderer,
  useClientContext,
  usePlaygroundTools,
} from "@flowgram.ai/free-layout-editor";
import type { FreeLayoutPluginContext } from "@flowgram.ai/free-layout-editor";
import { Button, Space, Message, Dropdown, Menu, Spin } from "@arco-design/web-react";
import { IconSave, IconPlayArrow, IconStop, IconUndo, IconRedo, IconMoreVertical } from "@arco-design/web-react/icon";
import type { Workflow, WorkflowNode, WorkflowEdge } from "@App/app/repo/workflow";
import { useTranslation } from "react-i18next";
import { nodeRegistry, createDefaultNodeData } from "../nodes/registry";
import Sidebar from "./Sidebar";
import NodePanel from "./NodePanel";

interface WorkflowEditorProps {
  workflow?: Workflow;
  onSave?: (workflow: Workflow) => void;
  onRun?: () => void;
  onStop?: () => void;
  isRunning?: boolean;
}

const WorkflowCanvas: React.FC = () => {
  const ctx = useClientContext();
  const nodes = ctx?.document?.nodes;

  if (!nodes) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spin size={32} />
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {nodes.map((node) => (
        <WorkflowNodeRenderer key={node.id} node={node}>
          <NodeContent node={node} />
        </WorkflowNodeRenderer>
      ))}
    </div>
  );
};

const NodeContent: React.FC<{ node: any }> = ({ node }) => {
  const NodeComponent = nodeRegistry[node.flowNodeType]?.component;

  if (NodeComponent) {
    return <NodeComponent node={node} />;
  }

  return (
    <div className="p-3 bg-white rounded-lg shadow-md border border-gray-200 min-w-32">
      <div className="font-medium text-gray-700">{node.data?.name || node.flowNodeType}</div>
    </div>
  );
};

const Toolbar: React.FC<{
  hasChanges: boolean;
  isRunning: boolean;
  onSave: () => void;
  onRun: () => void;
  onStop: () => void;
  onUndo: () => void;
  onRedo: () => void;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}> = ({ hasChanges, isRunning, onSave, onRun, onStop, onUndo, onRedo, sidebarVisible, onToggleSidebar }) => {
  const { t } = useTranslation();
  const tools = usePlaygroundTools();

  return (
    <div className="flex justify-between items-center p-2 border-b border-gray-200 bg-white">
      <Space>
        <Button type="primary" icon={<IconSave />} onClick={onSave} disabled={!hasChanges}>
          {t("save")}
        </Button>
        {isRunning ? (
          <Button status="danger" icon={<IconStop />} onClick={onStop}>
            {t("workflow_page.stop")}
          </Button>
        ) : (
          <Button type="outline" status="success" icon={<IconPlayArrow />} onClick={onRun}>
            {t("workflow_page.run")}
          </Button>
        )}
      </Space>
      <Space>
        <Button icon={<IconUndo />} onClick={onUndo} />
        <Button icon={<IconRedo />} onClick={onRedo} />
        <Button onClick={() => tools?.zoomin?.()}>{t("workflow_page.zoom_in")}</Button>
        <Button onClick={() => tools?.zoomout?.()}>{t("workflow_page.zoom_out")}</Button>
        <Button onClick={() => tools?.fitView?.()}>{t("workflow_page.fit_view")}</Button>
        <Dropdown
          droplist={
            <Menu>
              <Menu.Item key="toggle-sidebar" onClick={onToggleSidebar}>
                {sidebarVisible ? t("workflow_page.hide_sidebar") : t("workflow_page.show_sidebar")}
              </Menu.Item>
            </Menu>
          }
        >
          <Button icon={<IconMoreVertical />} />
        </Dropdown>
      </Space>
    </div>
  );
};

const WorkflowEditorInner: React.FC<WorkflowEditorProps> = ({
  workflow,
  onSave,
  onRun,
  onStop,
  isRunning = false,
}) => {
  const { t } = useTranslation();
  const ctx = useClientContext();
  const [hasChanges, setHasChanges] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (workflow && ctx?.operation && !isInitialized) {
      loadWorkflow(workflow);
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow, ctx?.operation]);

  const loadWorkflow = useCallback(
    (wf: Workflow) => {
      if (!ctx?.operation) return;

      const jsonData = {
        nodes: wf.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        })),
        edges: wf.edges.map((edge) => ({
          id: edge.id,
          source: edge.sourceNodeID,
          target: edge.targetNodeID,
          sourcePort: edge.sourcePortID,
          targetPort: edge.targetPortID,
        })),
      };
      ctx.operation.fromJSON(jsonData);
    },
    [ctx]
  );

  const handleAddNode = useCallback(
    (type: string) => {
      const nodeConfig = nodeRegistry[type];
      if (!nodeConfig || !ctx?.operation) {
        Message.error(t("workflow_page.unknown_node_type"));
        return;
      }

      const centerX = 400 + Math.random() * 200 - 100;
      const centerY = 300 + Math.random() * 200 - 100;

      ctx.operation.addFromNode(
        {
          id: `node_${Date.now()}`,
          type,
          position: { x: centerX, y: centerY },
          data: createDefaultNodeData(type),
        },
        { select: true }
      );
      setHasChanges(true);
    },
    [ctx, t]
  );

  const handleSave = useCallback(async () => {
    if (!ctx?.operation || !workflow) return;

    const jsonData = ctx.operation.toJSON();

    const nodes: WorkflowNode[] = jsonData.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      name: n.data?.name || n.type,
      data: n.data || {},
      position: n.position || { x: 0, y: 0 },
    }));

    const edges: WorkflowEdge[] = jsonData.edges.map((e: any) => ({
      id: e.id,
      sourceNodeID: e.source,
      targetNodeID: e.target,
      sourcePortID: e.sourcePort,
      targetPortID: e.targetPort,
    }));

    const updatedWorkflow: Workflow = {
      ...workflow,
      nodes,
      edges,
      updatetime: Date.now(),
    };

    onSave?.(updatedWorkflow);
    setHasChanges(false);
    Message.success(t("save_success"));
  }, [ctx, workflow, onSave, t]);

  const handleUndo = useCallback(() => {
    ctx?.history?.undo?.();
  }, [ctx]);

  const handleRedo = useCallback(() => {
    ctx?.history?.redo?.();
  }, [ctx]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <Toolbar
          hasChanges={hasChanges}
          isRunning={isRunning}
          onSave={handleSave}
          onRun={onRun || (() => {})}
          onStop={onStop || (() => {})}
          onUndo={handleUndo}
          onRedo={handleRedo}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        />
        <div className="flex-1 relative">
          <WorkflowCanvas />
          <NodePanel onAddNode={handleAddNode} />
        </div>
      </div>
      {sidebarVisible && (
        <div className="w-80 border-l border-gray-200 bg-white">
          <Sidebar />
        </div>
      )}
    </div>
  );
};

const WorkflowEditor: React.FC<WorkflowEditorProps> = (props) => {
  const { workflow } = props;
  const editorRef = useRef<FreeLayoutPluginContext>(null);

  const initialData = workflow
    ? {
        nodes: workflow.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        edges: workflow.edges.map((e) => ({
          id: e.id,
          source: e.sourceNodeID,
          target: e.targetNodeID,
          sourcePort: e.sourcePortID,
          targetPort: e.targetPortID,
        })),
      }
    : { nodes: [], edges: [] };

  const nodeRegistries = Object.entries(nodeRegistry).map(([type, config]) => ({
    type,
    meta: {
      defaultData: config.defaultData,
      label: config.label,
    },
  }));

  return (
    <FreeLayoutEditor
      ref={editorRef}
      initialData={initialData}
      nodeRegistries={nodeRegistries}
      onContentChange={(_ctx, event) => {
        console.log("Content changed:", event);
      }}
    >
      <WorkflowEditorInner {...props} />
    </FreeLayoutEditor>
  );
};

export default WorkflowEditor;
