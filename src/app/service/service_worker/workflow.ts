import type { Group } from "@Packages/message/server";
import type { IMessageQueue } from "@Packages/message/message_queue";
import {
  WorkflowDAO,
  WorkflowExecutionLogDAO,
  type Workflow,
  type WorkflowNode,
  type WorkflowExecutionLog,
} from "@App/app/repo/workflow";
import type Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";
import { v4 as uuidv4 } from "uuid";
import type { AutomationScriptService } from "./automationScript";

export class WorkflowService {
  private logger: Logger;
  private workflowDAO: WorkflowDAO;
  private executionLogDAO: WorkflowExecutionLogDAO;
  private runningExecutions: Map<string, boolean> = new Map();

  constructor(
    private group: Group,
    private mq: IMessageQueue,
    private automationScriptService: AutomationScriptService
  ) {
    this.logger = LoggerCore.logger().with({ service: "workflow" });
    this.workflowDAO = new WorkflowDAO();
    this.executionLogDAO = new WorkflowExecutionLogDAO();
  }

  async getAllWorkflows(): Promise<Workflow[]> {
    return this.workflowDAO.getAllWorkflows();
  }

  async getEnabledWorkflows(): Promise<Workflow[]> {
    return this.workflowDAO.getEnabledWorkflows();
  }

  async getByKey(key: string): Promise<Workflow | undefined> {
    return this.workflowDAO.getByKey(key);
  }

  async createWorkflow(workflow: Omit<Workflow, "id" | "createtime" | "updatetime">): Promise<Workflow> {
    const existing = await this.workflowDAO.getByKey(workflow.key);
    if (existing) {
      throw new Error("Workflow key already exists");
    }
    const now = Date.now();
    const newWorkflow: Workflow = {
      ...workflow,
      id: uuidv4(),
      createtime: now,
      updatetime: now,
    };
    await this.workflowDAO.saveWorkflow(newWorkflow);
    this.logger.info("create workflow", { name: workflow.name, key: workflow.key, id: newWorkflow.id });
    return newWorkflow;
  }

  async updateWorkflow(params: { id: string; changes: Partial<Workflow> }): Promise<Workflow | false> {
    const { id, changes } = params;
    if (changes.key) {
      const existing = await this.workflowDAO.getByKey(changes.key);
      if (existing && existing.id !== id) {
        throw new Error("Workflow key already exists");
      }
    }
    const result = await this.workflowDAO.updateWorkflow(id, {
      ...changes,
      updatetime: Date.now(),
    });
    if (result) {
      this.logger.info("update workflow", { id });
    }
    return result;
  }

  async deleteWorkflow(id: string): Promise<void> {
    const workflow = await this.workflowDAO.find((_, value) => value.id === id);
    if (workflow && workflow.length > 0) {
      await this.executionLogDAO.deleteLogsByWorkflowId(workflow[0].id);
    }
    await this.workflowDAO.deleteWorkflow(id);
    this.logger.info("delete workflow", { id });
  }

  async toggleWorkflow(params: { id: string; enabled: boolean }): Promise<Workflow | false> {
    return this.updateWorkflow({ id: params.id, changes: { enabled: params.enabled } });
  }

  async getExecutionLogs(params: { workflowId: string; limit?: number }): Promise<WorkflowExecutionLog[]> {
    return this.executionLogDAO.getLogsByWorkflowId(params.workflowId, params.limit || 50);
  }

  async getExecutionLogById(id: string): Promise<WorkflowExecutionLog | undefined> {
    return this.executionLogDAO.getLogById(id);
  }

  async createExecutionLog(log: Omit<WorkflowExecutionLog, "id" | "createtime">): Promise<WorkflowExecutionLog> {
    const newLog: WorkflowExecutionLog = {
      ...log,
      id: uuidv4(),
      createtime: Date.now(),
    };
    await this.executionLogDAO.saveLog(newLog);
    await this.executionLogDAO.clearOldLogs(log.workflowId, 100);
    return newLog;
  }

  async updateExecutionLog(params: {
    id: string;
    changes: Partial<WorkflowExecutionLog>;
  }): Promise<WorkflowExecutionLog | false> {
    return this.executionLogDAO.update(params.id, params.changes);
  }

  async deleteExecutionLog(id: string): Promise<void> {
    return this.executionLogDAO.deleteLog(id);
  }

  async runWorkflow(params: { workflowId: string; inputJson: string }): Promise<WorkflowExecutionLog> {
    const { workflowId, inputJson } = params;
    const workflow = await this.workflowDAO.find((_, value) => value.id === workflowId);
    if (!workflow || workflow.length === 0) {
      throw new Error("Workflow not found");
    }

    const wf = workflow[0];
    const startTime = Date.now();

    const log = await this.createExecutionLog({
      workflowId: wf.id,
      workflowKey: wf.key,
      status: "running",
      inputJson,
      nodeResults: {},
    });

    this.runningExecutions.set(log.id, true);

    try {
      let inputData: any;
      try {
        inputData = JSON.parse(inputJson);
      } catch {
        throw new Error("Invalid input JSON");
      }

      const context: WorkflowExecutionContext = {
        variables: { ...wf.variables, ...inputData },
        nodeResults: {},
        workflow: wf,
      };

      const startNode = wf.nodes.find((n) => n.type === "start");
      if (!startNode) {
        throw new Error("No start node found in workflow");
      }

      await this.executeNode(wf, startNode, context, log);

      const duration = Date.now() - startTime;
      const updatedLog = await this.executionLogDAO.update(log.id, {
        status: "success",
        outputJson: JSON.stringify(context.variables, null, 2),
        nodeResults: context.nodeResults,
        endtime: Date.now(),
        duration,
      });

      this.logger.info("workflow execution success", { workflowId: wf.id, duration });
      return updatedLog || log;
    } catch (e: any) {
      const duration = Date.now() - startTime;
      const updatedLog = await this.executionLogDAO.update(log.id, {
        status: "error",
        error: e.message || String(e),
        endtime: Date.now(),
        duration,
      });

      this.logger.error("workflow execution error", { workflowId: wf.id, error: e.message });
      return updatedLog || log;
    } finally {
      this.runningExecutions.delete(log.id);
    }
  }

  async stopWorkflowExecution(executionLogId: string): Promise<void> {
    this.runningExecutions.set(executionLogId, false);
    await this.executionLogDAO.update(executionLogId, {
      status: "cancelled",
      endtime: Date.now(),
    });
  }

  private async executeNode(
    workflow: Workflow,
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    log: WorkflowExecutionLog
  ): Promise<void> {
    if (!this.runningExecutions.get(log.id)) {
      throw new Error("Workflow execution was stopped");
    }

    const nodeStartTime = Date.now();

    await this.executionLogDAO.update(log.id, {
      currentNodeId: node.id,
    });

    try {
      let result: any;

      switch (node.type) {
        case "start":
          result = context.variables;
          break;

        case "end":
          result = context.variables;
          break;

        case "script":
          result = await this.executeScriptNode(node, context);
          break;

        case "condition":
          result = await this.executeConditionNode(workflow, node, context, log);
          return;

        case "loop":
          result = await this.executeLoopNode(workflow, node, context, log);
          return;

        case "variable":
          result = this.executeVariableNode(node, context);
          break;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      context.nodeResults[node.id] = {
        status: "success",
        output: result,
        duration: Date.now() - nodeStartTime,
      };

      const outgoingEdges = workflow.edges.filter((e) => e.sourceNodeID === node.id);
      for (const edge of outgoingEdges) {
        const nextNode = workflow.nodes.find((n) => n.id === edge.targetNodeID);
        if (nextNode && nextNode.type !== "condition" && nextNode.type !== "loop") {
          await this.executeNode(workflow, nextNode, context, log);
        }
      }
    } catch (e: any) {
      context.nodeResults[node.id] = {
        status: "error",
        error: e.message,
        duration: Date.now() - nodeStartTime,
      };
      throw e;
    }
  }

  private async executeScriptNode(node: WorkflowNode, context: WorkflowExecutionContext): Promise<any> {
    const { scriptKey, inputMapping, outputMapping } = node.data;

    if (!scriptKey) {
      throw new Error("Script key is required for script node");
    }

    const input: any = {};
    if (inputMapping && typeof inputMapping === "object") {
      for (const [key, path] of Object.entries(inputMapping)) {
        input[key] = this.getVariableValue(context.variables, path as string);
      }
    }

    const result = await this.automationScriptService.executeScript(scriptKey, input);

    if (!result.success) {
      throw new Error(result.error || "Script execution failed");
    }

    if (outputMapping && typeof outputMapping === "object") {
      for (const [key, path] of Object.entries(outputMapping)) {
        this.setVariableValue(context.variables, path as string, result.result?.[key]);
      }
    }

    return result.result;
  }

  private async executeConditionNode(
    workflow: Workflow,
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    log: WorkflowExecutionLog
  ): Promise<void> {
    const { conditions } = node.data;
    const outgoingEdges = workflow.edges.filter((e) => e.sourceNodeID === node.id);

    for (const condition of conditions || []) {
      const { expression, targetNodeId } = condition;
      if (this.evaluateCondition(expression, context.variables)) {
        const nextNode = workflow.nodes.find((n) => n.id === targetNodeId);
        if (nextNode) {
          await this.executeNode(workflow, nextNode, context, log);
        }
        return;
      }
    }

    const defaultEdge = outgoingEdges.find((e) => e.sourcePortID === "default");
    if (defaultEdge) {
      const nextNode = workflow.nodes.find((n) => n.id === defaultEdge.targetNodeID);
      if (nextNode) {
        await this.executeNode(workflow, nextNode, context, log);
      }
    }
  }

  private async executeLoopNode(
    workflow: Workflow,
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    log: WorkflowExecutionLog
  ): Promise<void> {
    const { arrayPath, itemVariable } = node.data;
    const array = this.getVariableValue(context.variables, arrayPath);

    if (!Array.isArray(array)) {
      throw new Error(`Variable at ${arrayPath} is not an array`);
    }

    for (const item of array) {
      if (!this.runningExecutions.get(log.id)) {
        throw new Error("Workflow execution was stopped");
      }

      if (itemVariable) {
        context.variables[itemVariable] = item;
      }

      const bodyStartEdge = workflow.edges.find((e) => e.sourceNodeID === node.id && e.sourcePortID === "body");
      if (bodyStartEdge) {
        const bodyStartNode = workflow.nodes.find((n) => n.id === bodyStartEdge.targetNodeID);
        if (bodyStartNode) {
          await this.executeNode(workflow, bodyStartNode, context, log);
        }
      }
    }
  }

  private executeVariableNode(node: WorkflowNode, context: WorkflowExecutionContext): any {
    const { variables } = node.data;

    if (variables && typeof variables === "object") {
      for (const [key, value] of Object.entries(variables)) {
        context.variables[key] = value;
      }
    }

    return context.variables;
  }

  private evaluateCondition(expression: string, variables: Record<string, any>): boolean {
    try {
      const func = new Function("variables", `with(variables) { return ${expression}; }`);
      return !!func(variables);
    } catch {
      return false;
    }
  }

  private getVariableValue(variables: Record<string, any>, path: string): any {
    if (!path) return undefined;
    const parts = path.split(".");
    let value: any = variables;
    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }
    return value;
  }

  private setVariableValue(variables: Record<string, any>, path: string, value: any): void {
    if (!path) return;
    const parts = path.split(".");
    let obj: any = variables;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in obj)) {
        obj[part] = {};
      }
      obj = obj[part];
    }
    obj[parts[parts.length - 1]] = value;
  }

  init() {
    this.group.on("getAllWorkflows", this.getAllWorkflows.bind(this));
    this.group.on("getEnabledWorkflows", this.getEnabledWorkflows.bind(this));
    this.group.on("getByKey", this.getByKey.bind(this));
    this.group.on("createWorkflow", this.createWorkflow.bind(this));
    this.group.on("updateWorkflow", this.updateWorkflow.bind(this));
    this.group.on("deleteWorkflow", this.deleteWorkflow.bind(this));
    this.group.on("toggleWorkflow", this.toggleWorkflow.bind(this));
    this.group.on("getExecutionLogs", this.getExecutionLogs.bind(this));
    this.group.on("getExecutionLogById", this.getExecutionLogById.bind(this));
    this.group.on("createExecutionLog", this.createExecutionLog.bind(this));
    this.group.on("updateExecutionLog", this.updateExecutionLog.bind(this));
    this.group.on("deleteExecutionLog", this.deleteExecutionLog.bind(this));
    this.group.on("runWorkflow", this.runWorkflow.bind(this));
    this.group.on("stopWorkflowExecution", this.stopWorkflowExecution.bind(this));
  }
}

interface WorkflowExecutionContext {
  variables: Record<string, any>;
  nodeResults: Record<string, { status: string; output?: any; error?: string; duration?: number }>;
  workflow: Workflow;
}
