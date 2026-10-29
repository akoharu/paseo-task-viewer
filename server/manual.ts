import { randomUUID } from "node:crypto";
import type { RpcInput } from "@getpaseo/plugin";
import {
  type createTaskRpc,
  type deleteTaskRpc,
  STATUS_GROUP_LABELS,
  type Task,
  type updateTaskRpc,
} from "../shared/tasks";
import { mutateTasks } from "./store";

export function createManualTask(input: RpcInput<typeof createTaskRpc>) {
  const now = new Date().toISOString();
  const task: Task = {
    id: `manual:${randomUUID()}`,
    source: "manual",
    externalId: null,
    identifier: null,
    title: input.title,
    description: input.description,
    url: input.url || null,
    status: STATUS_GROUP_LABELS.todo,
    statusGroup: "todo",
    statusColor: null,
    availableStatuses: [],
    container: null,
    priority: null,
    priorityRank: null,
    dueDate: null,
    cycle: null,
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
    missing: false,
    assignments: [],
  };
  return mutateTasks((tasks) => ({ tasks: [task, ...tasks], result: { task } }));
}

export function updateManualTask(input: RpcInput<typeof updateTaskRpc>) {
  return mutateTasks((tasks) => {
    const index = tasks.findIndex((task) => task.id === input.id);
    const current = tasks[index];
    if (!current) throw new Error("Task not found.");
    // Synced tickets mirror ClickUp or Linear, so only manual tasks are editable here.
    if (current.source !== "manual") throw new Error("Synced tickets are read-only. Change them in their own app.");
    const next: Task = {
      ...current,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      ...(input.statusGroup
        ? { statusGroup: input.statusGroup, status: STATUS_GROUP_LABELS[input.statusGroup] }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    tasks[index] = next;
    return { tasks, result: { task: next } };
  });
}

export function deleteTask(input: RpcInput<typeof deleteTaskRpc>) {
  return mutateTasks((tasks) => {
    const remaining = tasks.filter((task) => task.id !== input.id);
    return { tasks: remaining, result: { deleted: remaining.length !== tasks.length } };
  });
}
