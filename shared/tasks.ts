import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const taskSourceSchema = z.enum(["manual", "clickup", "linear"]);
export type TaskSource = z.infer<typeof taskSourceSchema>;

// A normalized status group, so ClickUp and Linear statuses can share filters and colors.
export const statusGroupSchema = z.enum(["todo", "in_progress", "review", "done", "canceled"]);
export type StatusGroup = z.infer<typeof statusGroupSchema>;

export const ticketStatusSchema = z.object({
  name: z.string(),
  group: statusGroupSchema,
});
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const delegationModeSchema = z.enum(["local", "worktree"]);
export type DelegationMode = z.infer<typeof delegationModeSchema>;

export const assignmentSchema = z.object({
  agentId: z.string(),
  workspaceId: z.string(),
  projectName: z.string(),
  mode: delegationModeSchema,
  branch: z.string().nullable(),
  provider: z.string(),
  createdAt: z.string(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

export const taskSchema = z.object({
  id: z.string(),
  source: taskSourceSchema,
  externalId: z.string().nullable(),
  identifier: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  url: z.string().nullable(),
  status: z.string(),
  statusGroup: statusGroupSchema,
  statusColor: z.string().nullable(),
  // Statuses the ticket can move to in its source system. Empty for manual tasks.
  availableStatuses: z.array(ticketStatusSchema),
  container: z.string().nullable(),
  priority: z.string().nullable(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  syncedAt: z.string().nullable(),
  // True when the ticket left your assigned queue: unassigned, filtered out, deleted, or no access.
  missing: z.boolean(),
  assignments: z.array(assignmentSchema),
});
export type Task = z.infer<typeof taskSchema>;

export const syncStateSchema = z.object({
  running: z.boolean(),
  lastRunAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  errors: z.array(z.string()),
});
export type SyncState = z.infer<typeof syncStateSchema>;

const taskListOutput = z.object({ tasks: z.array(taskSchema), sync: syncStateSchema });
export type TaskListOutput = z.infer<typeof taskListOutput>;

export const listTasksRpc = defineRpc({
  name: "tasks.list",
  input: z.object({}),
  output: taskListOutput,
});

export const syncTasksRpc = defineRpc({
  name: "tasks.sync",
  input: z.object({}),
  output: taskListOutput,
});

export const createTaskRpc = defineRpc({
  name: "tasks.create",
  input: z.object({
    title: z.string().trim().min(1),
    description: z.string(),
    url: z.string().trim().nullable(),
  }),
  output: z.object({ task: taskSchema }),
});

export const updateTaskRpc = defineRpc({
  name: "tasks.update",
  input: z.object({
    id: z.string(),
    title: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    statusGroup: statusGroupSchema.optional(),
  }),
  output: z.object({ task: taskSchema }),
});

export const deleteTaskRpc = defineRpc({
  name: "tasks.delete",
  input: z.object({ id: z.string() }),
  output: z.object({ deleted: z.boolean() }),
});

export const delegateTaskRpc = defineRpc({
  name: "tasks.delegate",
  input: z.object({
    taskId: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    projectPath: z.string(),
    mode: delegationModeSchema,
    // Local mode: empty means "stay on the current branch". Worktree mode: required.
    branch: z.string().trim(),
    baseBranch: z.string().trim(),
    provider: z.string().min(1),
    model: z.string(),
    extraInstructions: z.string(),
  }),
  output: z.object({ agentId: z.string(), workspaceId: z.string(), task: taskSchema }),
});

export const credentialProviderSchema = z.enum(["clickup", "linear"]);
export type CredentialProvider = z.infer<typeof credentialProviderSchema>;

const credentialStatus = z.object({
  configured: z.boolean(),
  origin: z.enum(["env", "saved"]).nullable(),
});

export const credentialStatusRpc = defineRpc({
  name: "credentials.status",
  input: z.object({}),
  output: z.object({ clickup: credentialStatus, linear: credentialStatus }),
});

export const saveCredentialRpc = defineRpc({
  name: "credentials.save",
  input: z.object({ provider: credentialProviderSchema, token: z.string().trim().nullable() }),
  output: z.object({ saved: z.boolean() }),
});

export const testCredentialRpc = defineRpc({
  name: "credentials.test",
  input: z.object({ provider: credentialProviderSchema }),
  output: z.object({ ok: z.boolean(), message: z.string() }),
});

export const SOURCE_LABELS: Record<TaskSource, string> = {
  manual: "Manual",
  clickup: "ClickUp",
  linear: "Linear",
};

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "In review",
  done: "Done",
  canceled: "Canceled",
};

export function isOpenStatus(group: StatusGroup): boolean {
  return group !== "done" && group !== "canceled";
}

// Turns "ENG-123" + "Fix login redirect" into "eng-123-fix-login-redirect".
export function suggestBranchName(task: Pick<Task, "identifier" | "title">): string {
  const base = [task.identifier, task.title].filter(Boolean).join(" ");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "task";
}
