import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkflowDAO, WorkflowExecutionLogDAO, type Workflow, type WorkflowExecutionLog } from "@App/app/repo/workflow";

vi.mock("@App/app/repo/repo", () => {
    const mockData: Map<string, Map<string, any>> = new Map();

    return {
        Repo: class {
            private storeName: string;
            private data: Map<string, any>;

            constructor(storeName: string) {
                this.storeName = storeName;
                if (!mockData.has(storeName)) {
                    mockData.set(storeName, new Map());
                }
                this.data = mockData.get(storeName)!;
            }

            async find(predicate?: (key: string, value: any) => boolean): Promise<any[]> {
                const results: any[] = [];
                this.data.forEach((value, key) => {
                    if (!predicate || predicate(key, value)) {
                        results.push(value);
                    }
                });
                return results;
            }

            async findOne(predicate: (key: string, value: any) => boolean): Promise<any | undefined> {
                for (const [key, value] of this.data) {
                    if (predicate(key, value)) {
                        return value;
                    }
                }
                return undefined;
            }

            async get(id: string): Promise<any | undefined> {
                return this.data.get(id);
            }

            async _save(id: string, value: any): Promise<any> {
                this.data.set(id, value);
                return value;
            }

            async delete(id: string): Promise<void> {
                this.data.delete(id);
            }

            async update(id: string, changes: Partial<any>): Promise<any | false> {
                const existing = this.data.get(id);
                if (!existing) return false;
                const updated = { ...existing, ...changes };
                this.data.set(id, updated);
                return updated;
            }
        },
    };
});

describe("WorkflowDAO", () => {
    let workflowDAO: WorkflowDAO;

    beforeEach(() => {
        workflowDAO = new WorkflowDAO();
    });

    describe("create and save workflow", () => {
        it("should save a workflow successfully", async () => {
            const workflow: Workflow = {
                id: "test-id-1",
                key: "test-workflow",
                name: "Test Workflow",
                description: "A test workflow",
                nodes: [
                    { id: "start", type: "start", name: "Start", data: {}, position: { x: 0, y: 0 } },
                    { id: "end", type: "end", name: "End", data: {}, position: { x: 100, y: 0 } },
                ],
                edges: [],
                variables: {},
                enabled: true,
                createtime: Date.now(),
                updatetime: Date.now(),
            };

            const result = await workflowDAO.saveWorkflow(workflow);
            expect(result).toEqual(workflow);

            const retrieved = await workflowDAO.get("test-id-1");
            expect(retrieved).toEqual(workflow);
        });

        it("should get all workflows sorted by updatetime", async () => {
            const workflow1: Workflow = {
                id: "test-id-1",
                key: "workflow-1",
                name: "Workflow 1",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: 1000,
                updatetime: 1000,
            };

            const workflow2: Workflow = {
                id: "test-id-2",
                key: "workflow-2",
                name: "Workflow 2",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: 2000,
                updatetime: 2000,
            };

            await workflowDAO.saveWorkflow(workflow1);
            await workflowDAO.saveWorkflow(workflow2);

            const all = await workflowDAO.getAllWorkflows();
            expect(all).toHaveLength(2);
            expect(all[0].id).toBe("test-id-2");
            expect(all[1].id).toBe("test-id-1");
        });

        it("should get enabled workflows", async () => {
            const workflow1: Workflow = {
                id: "test-id-1",
                key: "workflow-1",
                name: "Workflow 1",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: 1000,
                updatetime: 1000,
            };

            const workflow2: Workflow = {
                id: "test-id-2",
                key: "workflow-2",
                name: "Workflow 2",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: false,
                createtime: 2000,
                updatetime: 2000,
            };

            await workflowDAO.saveWorkflow(workflow1);
            await workflowDAO.saveWorkflow(workflow2);

            const enabled = await workflowDAO.getEnabledWorkflows();
            expect(enabled).toHaveLength(1);
            expect(enabled[0].id).toBe("test-id-1");
        });

        it("should get workflow by key", async () => {
            const workflow: Workflow = {
                id: "test-id-1",
                key: "unique-key",
                name: "Test Workflow",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: Date.now(),
                updatetime: Date.now(),
            };

            await workflowDAO.saveWorkflow(workflow);

            const found = await workflowDAO.getByKey("unique-key");
            expect(found).toBeDefined();
            expect(found?.id).toBe("test-id-1");

            const notFound = await workflowDAO.getByKey("non-existent");
            expect(notFound).toBeUndefined();
        });

        it("should update workflow", async () => {
            const workflow: Workflow = {
                id: "test-id-1",
                key: "workflow-1",
                name: "Original Name",
                description: "",
                nodes: [],
                edges: [],
                variables: {},
                enabled: true,
                createtime: Date.now(),
                updatetime: Date.now(),
            };

            await workflowDAO.saveWorkflow(workflow);

            const updated = await workflowDAO.updateWorkflow("test-id-1", { name: "Updated Name" });
            expect(updated).toBeDefined();
            if (updated) {
                expect(updated.name).toBe("Updated Name");
            }

            const retrieved = await workflowDAO.get("test-id-1");
            expect(retrieved?.name).toBe("Updated Name");
        });

        it("should delete workflow", async () => {
            const workflow: Workflow = {
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
            };

            await workflowDAO.saveWorkflow(workflow);
            await workflowDAO.deleteWorkflow("test-id-1");

            const retrieved = await workflowDAO.get("test-id-1");
            expect(retrieved).toBeUndefined();
        });
    });
});

describe("WorkflowExecutionLogDAO", () => {
    let logDAO: WorkflowExecutionLogDAO;

    beforeEach(() => {
        logDAO = new WorkflowExecutionLogDAO();
    });

    describe("execution logs", () => {
        it("should save and retrieve execution log", async () => {
            const log: WorkflowExecutionLog = {
                id: "log-id-1",
                workflowId: "workflow-1",
                workflowKey: "test-workflow",
                status: "success",
                inputJson: '{"key": "value"}',
                outputJson: '{"result": "ok"}',
                createtime: Date.now(),
                starttime: Date.now(),
                endtime: Date.now() + 1000,
                duration: 1000,
            };

            const saved = await logDAO.saveLog(log);
            expect(saved).toEqual(log);

            const retrieved = await logDAO.getLogById("log-id-1");
            expect(retrieved).toEqual(log);
        });

        it("should get logs by workflow id", async () => {
            const log1: WorkflowExecutionLog = {
                id: "log-id-1",
                workflowId: "workflow-1",
                workflowKey: "test-workflow",
                status: "success",
                inputJson: "{}",
                createtime: 1000,
            };

            const log2: WorkflowExecutionLog = {
                id: "log-id-2",
                workflowId: "workflow-1",
                workflowKey: "test-workflow",
                status: "error",
                inputJson: "{}",
                createtime: 2000,
            };

            const log3: WorkflowExecutionLog = {
                id: "log-id-3",
                workflowId: "workflow-2",
                workflowKey: "other-workflow",
                status: "success",
                inputJson: "{}",
                createtime: 3000,
            };

            await logDAO.saveLog(log1);
            await logDAO.saveLog(log2);
            await logDAO.saveLog(log3);

            const logs = await logDAO.getLogsByWorkflowId("workflow-1");
            expect(logs).toHaveLength(2);
            expect(logs[0].id).toBe("log-id-2");
            expect(logs[1].id).toBe("log-id-1");
        });

        it("should limit number of logs returned", async () => {
            for (let i = 0; i < 10; i++) {
                const log: WorkflowExecutionLog = {
                    id: `log-id-${i}`,
                    workflowId: "workflow-1",
                    workflowKey: "test-workflow",
                    status: "success",
                    inputJson: "{}",
                    createtime: i * 1000,
                };
                await logDAO.saveLog(log);
            }

            const logs = await logDAO.getLogsByWorkflowId("workflow-1", 5);
            expect(logs).toHaveLength(5);
        });

        it("should delete logs by workflow id", async () => {
            const log: WorkflowExecutionLog = {
                id: "log-id-1",
                workflowId: "workflow-1",
                workflowKey: "test-workflow",
                status: "success",
                inputJson: "{}",
                createtime: Date.now(),
            };

            await logDAO.saveLog(log);
            await logDAO.deleteLogsByWorkflowId("workflow-1");

            const logs = await logDAO.getLogsByWorkflowId("workflow-1");
            expect(logs).toHaveLength(0);
        });

        it("should update execution log", async () => {
            const log: WorkflowExecutionLog = {
                id: "log-id-1",
                workflowId: "workflow-1",
                workflowKey: "test-workflow",
                status: "running",
                inputJson: "{}",
                createtime: Date.now(),
            };

            await logDAO.saveLog(log);

            const updated = await logDAO.update("log-id-1", {
                status: "success",
                outputJson: '{"result": "ok"}',
            });

            if (updated) {
                expect(updated.status).toBe("success");
                expect(updated.outputJson).toBe('{"result": "ok"}');
            }
        });

        it("should clear old logs keeping only specified count", async () => {
            for (let i = 0; i < 10; i++) {
                const log: WorkflowExecutionLog = {
                    id: `log-id-${i}`,
                    workflowId: "workflow-1",
                    workflowKey: "test-workflow",
                    status: "success",
                    inputJson: "{}",
                    createtime: i * 1000,
                };
                await logDAO.saveLog(log);
            }

            await logDAO.clearOldLogs("workflow-1", 5);

            const logs = await logDAO.getLogsByWorkflowId("workflow-1");
            expect(logs).toHaveLength(5);
        });
    });
});
