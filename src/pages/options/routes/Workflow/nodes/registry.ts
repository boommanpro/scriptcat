import type React from "react";
import StartNode from "./StartNode";
import EndNode from "./EndNode";
import ScriptNode from "./ScriptNode";
import ConditionNode from "./ConditionNode";
import LoopNode from "./LoopNode";
import VariableNode from "./VariableNode";

export interface NodeConfig {
  type: string;
  label: string;
  icon?: React.ReactNode;
  component: React.FC<{ node: any }>;
  defaultData: Record<string, any>;
  color?: string;
}

export const nodeRegistry: Record<string, NodeConfig> = {
  start: {
    type: "start",
    label: "workflow_page.node_start",
    component: StartNode,
    defaultData: {
      name: "Start",
    },
    color: "#52c41a",
  },
  end: {
    type: "end",
    label: "workflow_page.node_end",
    component: EndNode,
    defaultData: {
      name: "End",
    },
    color: "#ff4d4f",
  },
  script: {
    type: "script",
    label: "workflow_page.node_script",
    component: ScriptNode,
    defaultData: {
      name: "Script",
      scriptKey: "",
      inputMapping: {},
      outputMapping: {},
    },
    color: "#1890ff",
  },
  condition: {
    type: "condition",
    label: "workflow_page.node_condition",
    component: ConditionNode,
    defaultData: {
      name: "Condition",
      conditions: [],
    },
    color: "#faad14",
  },
  loop: {
    type: "loop",
    label: "workflow_page.node_loop",
    component: LoopNode,
    defaultData: {
      name: "Loop",
      arrayPath: "",
      itemVariable: "item",
    },
    color: "#722ed1",
  },
  variable: {
    type: "variable",
    label: "workflow_page.node_variable",
    component: VariableNode,
    defaultData: {
      name: "Variable",
      variables: {},
    },
    color: "#13c2c2",
  },
};

export function createDefaultNodeData(type: string): Record<string, any> {
  const config = nodeRegistry[type];
  if (!config) {
    return { name: type };
  }
  return { ...config.defaultData };
}

export function getNodeTypes(): string[] {
  return Object.keys(nodeRegistry);
}

export function getNodeConfig(type: string): NodeConfig | undefined {
  return nodeRegistry[type];
}
