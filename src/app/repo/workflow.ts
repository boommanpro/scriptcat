import { Repo } from "./repo";

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  sourceNodeID: string;
  targetNodeID: string;
  sourcePortID?: string;
  targetPortID?: string;
}

export interface Workflow {
  id: string;
  key: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, any>;
  enabled: boolean;
  createtime: number;
  updatetime: number;
}

export interface WorkflowExecutionLog {
  id: string;
  workflowId: string;
  workflowKey: string;
  status: "pending" | "running" | "success" | "error" | "cancelled";
  inputJson: string;
  outputJson?: string;
  currentNodeId?: string;
  nodeResults?: Record<string, { status: string; output?: any; error?: string; duration?: number }>;
  error?: string;
  createtime: number;
  starttime?: number;
  endtime?: number;
  duration?: number;
}

export class WorkflowDAO extends Repo<Workflow> {
  constructor() {
    super("workflow");
  }

  async getAllWorkflows(): Promise<Workflow[]> {
    const workflows = await this.find();
    return workflows.sort((a, b) => b.updatetime - a.updatetime);
  }

  async getEnabledWorkflows(): Promise<Workflow[]> {
    const workflows = await this.find((_, value) => value.enabled === true);
    return workflows.sort((a, b) => a.createtime - b.createtime);
  }

  async getByKey(key: string): Promise<Workflow | undefined> {
    return this.findOne((_, value) => value.key === key);
  }

  async saveWorkflow(workflow: Workflow): Promise<Workflow> {
    return this._save(workflow.id, workflow);
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.delete(id);
  }

  async updateWorkflow(id: string, changes: Partial<Workflow>): Promise<Workflow | false> {
    return this.update(id, changes);
  }
}

export class WorkflowExecutionLogDAO extends Repo<WorkflowExecutionLog> {
  constructor() {
    super("workflowExecutionLog");
  }

  async getLogsByWorkflowId(workflowId: string, limit: number = 50): Promise<WorkflowExecutionLog[]> {
    const logs = await this.find((_, value) => value.workflowId === workflowId);
    return logs.sort((a, b) => b.createtime - a.createtime).slice(0, limit);
  }

  async getLogById(id: string): Promise<WorkflowExecutionLog | undefined> {
    return this.get(id);
  }

  async saveLog(log: WorkflowExecutionLog): Promise<WorkflowExecutionLog> {
    return this._save(log.id, log);
  }

  async deleteLog(id: string): Promise<void> {
    return this.delete(id);
  }

  async deleteLogsByWorkflowId(workflowId: string): Promise<void> {
    const logs = await this.find((_, value) => value.workflowId === workflowId);
    for (const log of logs) {
      await this.delete(log.id);
    }
  }

  async clearOldLogs(workflowId: string, keepCount: number = 100): Promise<void> {
    const logs = await this.find((_, value) => value.workflowId === workflowId);
    const sortedLogs = logs.sort((a, b) => b.createtime - a.createtime);
    const toDelete = sortedLogs.slice(keepCount);
    for (const log of toDelete) {
      await this.delete(log.id);
    }
  }
}
