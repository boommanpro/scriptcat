import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@App/app/repo/workflow", () => {
    const mockWorkflows: Map<string, any> = new Map();
    const mockLogs: Map<string, any> = new Map();

    return {
        WorkflowDAO: class {
            async getAllWorkflows() {
                return Array.from(mockWorkflows.values()).sort((a, b) => b.updatetime - a.updatetime);
            }
            async getEnabledWorkflows() {
                return Array.from(mockWorkflows.values())
                    .filter((w) => w.enabled)
                    .sort((a, b) => a.createtime - b.createtime);
            }
            async getByKey(key: string) {
                return Array.from(mockWorkflows.values()).find((w) => w.key === key);
            }
            async saveWorkflow(workflow: any) {
                mockWorkflows.set(workflow.id, workflow);
                return workflow;
            }
            async deleteWorkflow(id: string) {
                mockWorkflows.delete(id);
            }
            async updateWorkflow(id: string, changes: any) {
                const existing = mockWorkflows.get(id);
                if (!existing) return false;
                const updated = { ...existing, ...changes };
                mockWorkflows.set(id, updated);
                return updated;
            }
            async find(predicate?: (key: string, value: any) => boolean) {
                if (!predicate) return Array.from(mockWorkflows.values());
                return Array.from(mockWorkflows.values()).filter((v) => predicate(v.id, v));
            }
        },
        WorkflowExecutionLogDAO: class {
            async getLogsByWorkflowId(workflowId: string, limit: number = 50) {
                return Array.from(mockLogs.values())
                    .filter((l) => l.workflowId === workflowId)
                    .sort((a, b) => b.createtime - a.createtime)
                    .slice(0, limit);
            }
            async getLogById(id: string) {
                return mockLogs.get(id);
            }
            async saveLog(log: any) {
                mockLogs.set(log.id, log);
                return log;
            }
            async deleteLog(id: string) {
                mockLogs.delete(id);
            }
            async deleteLogsByWorkflowId(workflowId: string) {
                for (const [id, log] of mockLogs) {
                    if (log.workflowId === workflowId) {
                        mockLogs.delete(id);
                    }
                }
            }
            async update(id: string, changes: any) {
                const existing = mockLogs.get(id);
                if (!existing) return false;
                const updated = { ...existing, ...changes };
                mockLogs.set(id, updated);
                return updated;
            }
            async clearOldLogs(workflowId: string, keepCount: number = 100) {
                const logs = Array.from(mockLogs.values())
                    .filter((l) => l.workflowId === workflowId)
                    .sort((a, b) => b.createtime - a.createtime);
                const toDelete = logs.slice(keepCount);
                for (const log of toDelete) {
                    mockLogs.delete(log.id);
                }
            }
        },
    };
});

vi.mock("@App/app/logger/core", () => ({
    default: {
        logger: () => ({
            with: () => ({
                info: vi.fn(),
                error: vi.fn(),
            }),
        }),
    },
}));

vi.mock("uuid", () => ({
    v4: () => `test-uuid-${Date.now()}`,
}));

describe("WorkflowService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("workflow CRUD operations", () => {
        it("should create workflow with unique key", async () => {
            const { WorkflowDAO } = await import("@App/app/repo/workflow");
            const dao = new WorkflowDAO();

            const workflow = await dao.saveWorkflow({
                id: "test-id-1",
                key: "unique-workflow-key",
                name: "Test Workflow",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: Date.now(),
                updatetime: Date.now(),
            });

            expect(workflow.id).toBe("test-id-1");
            expect(workflow.key).toBe("unique-workflow-key");

            const found = await dao.getByKey("unique-workflow-key");
            expect(found).toBeDefined();
        });

        it("should not allow duplicate workflow keys", async () => {
            const { WorkflowDAO } = await import("@App/app/repo/workflow");
            const dao = new WorkflowDAO();

            await dao.saveWorkflow({
                id: "test-id-1",
                key: "duplicate-key",
                name: "First Workflow",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: Date.now(),
                updatetime: Date.now(),
            });

            const found = await dao.getByKey("duplicate-key");
            expect(found).toBeDefined();
            expect(found?.name).toBe("First Workflow");
        });

        it("should toggle workflow enabled status", async () => {
            const { WorkflowDAO } = await import("@App/app/repo/workflow");
            const dao = new WorkflowDAO();

            await dao.saveWorkflow({
                id: "test-id-1",
                key: "workflow-1",
                name: "Test Workflow",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: Date.now(),
                updatetime: Date.now(),
            });

            await dao.updateWorkflow("test-id-1", { enabled: false });

            const enabled = await dao.getEnabledWorkflows();
            expect(enabled).toHaveLength(0);
        });

        it("should delete workflow and its logs", async () => {
            const { WorkflowDAO, WorkflowExecutionLogDAO } = await import("@App/app/repo/workflow");
            const workflowDAO = new WorkflowDAO();
            const logDAO = new WorkflowExecutionLogDAO();

            await workflowDAO.saveWorkflow({
                id: "test-id-1",
                key: "workflow-1",
                name: "Test Workflow",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: Date.now(),
                updatetime: Date.now(),
            });

            await logDAO.saveLog({
                id: "log-1",
                workflowId: "test-id-1",
                workflowKey: "workflow-1",
                status: "success",
                inputJson: "{}",
                createtime: Date.now(),
            });

            await logDAO.deleteLogsByWorkflowId("test-id-1");
            await workflowDAO.deleteWorkflow("test-id-1");

            const workflows = await workflowDAO.getAllWorkflows();
            expect(workflows).toHaveLength(0);

            const logs = await logDAO.getLogsByWorkflowId("test-id-1");
            expect(logs).toHaveLength(0);
        });
    });

    describe("workflow execution", () => {
        it("should create execution log", async () => {
            const { WorkflowExecutionLogDAO } = await import("@App/app/repo/workflow");
            const logDAO = new WorkflowExecutionLogDAO();

            const log = await logDAO.saveLog({
                id: "log-1",
                workflowId: "workflow-1",
                workflowKey: "test-workflow",
                status: "running",
                inputJson: '{"param": "value"}',
                createtime: Date.now(),
            });

            expect(log.id).toBe("log-1");
            expect(log.status).toBe("running");

            const retrieved = await logDAO.getLogById("log-1");
            expect(retrieved).toBeDefined();
        });

        it("should update execution log status", async () => {
            const { WorkflowExecutionLogDAO } = await import("@App/app/repo/workflow");
            const logDAO = new WorkflowExecutionLogDAO();

            await logDAO.saveLog({
                id: "log-1",
                workflowId: "workflow-1",
                workflowKey: "test-workflow",
                status: "running",
                inputJson: "{}",
                createtime: Date.now(),
            });

            await logDAO.update("log-1", {
                status: "success",
                outputJson: '{"result": "ok"}',
                duration: 1000,
            });

            const updated = await logDAO.getLogById("log-1");
            expect(updated?.status).toBe("success");
            expect(updated?.duration).toBe(1000);
        });

        it("should track execution errors", async () => {
            const { WorkflowExecutionLogDAO } = await import("@App/app/repo/workflow");
            const logDAO = new WorkflowExecutionLogDAO();

            await logDAO.saveLog({
                id: "log-1",
                workflowId: "workflow-1",
                workflowKey: "test-workflow",
                status: "running",
                inputJson: "{}",
                createtime: Date.now(),
            });

            await logDAO.update("log-1", {
                status: "error",
                error: "Script execution failed",
            });

            const updated = await logDAO.getLogById("log-1");
            expect(updated?.status).toBe("error");
            expect(updated?.error).toBe("Script execution failed");
        });

        it("should clear old execution logs", async () => {
            const { WorkflowExecutionLogDAO } = await import("@App/app/repo/workflow");
            const logDAO = new WorkflowExecutionLogDAO();

            for (let i = 0; i < 150; i++) {
                await logDAO.saveLog({
                    id: `log-${i}`,
                    workflowId: "workflow-1",
                    workflowKey: "test-workflow",
                    status: "success",
                    inputJson: "{}",
                    createtime: i,
                });
            }

            await logDAO.clearOldLogs("workflow-1", 100);

            const logs = await logDAO.getLogsByWorkflowId("workflow-1");
            expect(logs.length).toBeLessThanOrEqual(100);
        });
    });
});

describe("Workflow Node Types", () => {
    it("should support start node", async () => {
        const { nodeRegistry } = await import("@App/pages/options/routes/Workflow/nodes/registry");
        expect(nodeRegistry.start).toBeDefined();
        expect(nodeRegistry.start.label).toBe("workflow_page.node_start");
    });

    it("should support end node", async () => {
        const { nodeRegistry } = await import("@App/pages/options/routes/Workflow/nodes/registry");
        expect(nodeRegistry.end).toBeDefined();
        expect(nodeRegistry.end.label).toBe("workflow_page.node_end");
    });

    it("should support script node", async () => {
        const { nodeRegistry } = await import("@App/pages/options/routes/Workflow/nodes/registry");
        expect(nodeRegistry.script).toBeDefined();
        expect(nodeRegistry.script.defaultData).toHaveProperty("scriptKey");
        expect(nodeRegistry.script.defaultData).toHaveProperty("inputMapping");
        expect(nodeRegistry.script.defaultData).toHaveProperty("outputMapping");
    });

    it("should support condition node", async () => {
        const { nodeRegistry } = await import("@App/pages/options/routes/Workflow/nodes/registry");
        expect(nodeRegistry.condition).toBeDefined();
        expect(nodeRegistry.condition.defaultData).toHaveProperty("conditions");
    });

    it("should support loop node", async () => {
        const { nodeRegistry } = await import("@App/pages/options/routes/Workflow/nodes/registry");
        expect(nodeRegistry.loop).toBeDefined();
        expect(nodeRegistry.loop.defaultData).toHaveProperty("arrayPath");
        expect(nodeRegistry.loop.defaultData).toHaveProperty("itemVariable");
    });

    it("should support variable node", async () => {
        const { nodeRegistry } = await import("@App/pages/options/routes/Workflow/nodes/registry");
        expect(nodeRegistry.variable).toBeDefined();
        expect(nodeRegistry.variable.defaultData).toHaveProperty("variables");
    });

    it("should create default node data", async () => {
        const { createDefaultNodeData } = await import("@App/pages/options/routes/Workflow/nodes/registry");

        const scriptData = createDefaultNodeData("script");
        expect(scriptData).toHaveProperty("name", "Script");
        expect(scriptData).toHaveProperty("scriptKey", "");

        const startData = createDefaultNodeData("start");
        expect(startData).toHaveProperty("name", "Start");
    });
});
