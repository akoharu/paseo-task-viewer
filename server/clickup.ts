import { z } from "zod";
import type { StatusGroup, TicketStatus } from "../shared/tasks";
import { HttpError, looksLikeReview, type RemoteTicket, requestJson } from "./remote";

const API = "https://api.clickup.com/api/v2";

const statusSchema = z.object({
  status: z.string(),
  type: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

const taskSchema = z.object({
  id: z.string(),
  custom_id: z.string().nullable().optional(),
  name: z.string(),
  markdown_description: z.string().nullable().optional(),
  text_content: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: statusSchema,
  url: z.string().nullable().optional(),
  list: z.object({ id: z.string(), name: z.string().optional() }).nullable().optional(),
  priority: z.object({ priority: z.string().nullable().optional() }).nullable().optional(),
  due_date: z.string().nullable().optional(),
  date_updated: z.string().nullable().optional(),
});
type ClickUpTask = z.infer<typeof taskSchema>;

function client(token: string) {
  return (path: string) =>
    requestJson(`${API}${path}`, { headers: { Authorization: token } }, `ClickUp ${path.split("?")[0]}`);
}

function groupFor(status: z.infer<typeof statusSchema>): StatusGroup {
  const name = status.status.toLowerCase();
  if (status.type === "closed" || status.type === "done") {
    return /cancel|reject|won.?t|duplicate/.test(name) ? "canceled" : "done";
  }
  if (status.type === "open") return "todo";
  if (looksLikeReview(name)) return "review";
  if (/backlog|to ?do|todo|ready|planned|open/.test(name)) return "todo";
  return "in_progress";
}

const CLICKUP_PRIORITY_RANK: Record<string, number> = { urgent: 1, high: 2, normal: 3, low: 4 };

function toIso(ms: string | null | undefined): string | null {
  if (!ms) return null;
  const value = Number(ms);
  return Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function toTicket(task: ClickUpTask, statuses: TicketStatus[]): RemoteTicket {
  const priority = task.priority?.priority?.toLowerCase() ?? null;
  return {
    externalId: task.id,
    identifier: task.custom_id ?? null,
    title: task.name,
    description: task.markdown_description || task.text_content || task.description || "",
    url: task.url ?? `https://app.clickup.com/t/${task.id}`,
    status: task.status.status,
    statusGroup: groupFor(task.status),
    statusColor: task.status.color ?? null,
    availableStatuses: statuses,
    container: task.list?.name ?? null,
    priority: priority ? priority[0].toUpperCase() + priority.slice(1) : null,
    priorityRank: priority ? (CLICKUP_PRIORITY_RANK[priority] ?? null) : null,
    dueDate: toIso(task.due_date),
    // ClickUp has no cycles. Sprints are plain lists, shown as the list name.
    cycle: null,
    remoteUpdatedAt: toIso(task.date_updated),
  };
}

export interface ClickUpOptions {
  teamIds: string[];
  listIds: string[];
}

export async function fetchClickUp(token: string, options: ClickUpOptions) {
  const get = client(token);
  const user = z.object({ user: z.object({ id: z.number() }) }).parse(await get("/user"));

  let teamIds = options.teamIds;
  if (teamIds.length === 0) {
    const teams = z
      .object({ teams: z.array(z.object({ id: z.string() })) })
      .parse(await get("/team"));
    teamIds = teams.teams.map((team) => team.id);
  }

  const raw: ClickUpTask[] = [];
  for (const teamId of teamIds) {
    for (let page = 0; page < 5; page += 1) {
      const query = new URLSearchParams({
        page: String(page),
        subtasks: "true",
        include_markdown_description: "true",
        order_by: "updated",
      });
      query.append("assignees[]", String(user.user.id));
      for (const listId of options.listIds) query.append("list_ids[]", listId);
      const result = z
        .object({ tasks: z.array(taskSchema), last_page: z.boolean().optional() })
        .parse(await get(`/team/${teamId}/task?${query.toString()}`));
      raw.push(...result.tasks);
      if (result.last_page !== false || result.tasks.length < 100) break;
    }
  }

  const statusCache = new Map<string, Promise<TicketStatus[]>>();
  const statusesFor = (listId: string | undefined) => {
    if (!listId) return Promise.resolve([]);
    let pending = statusCache.get(listId);
    if (!pending) {
      pending = listStatuses(get, listId);
      statusCache.set(listId, pending);
    }
    return pending;
  };

  const open: RemoteTicket[] = [];
  for (const task of raw) {
    open.push(toTicket(task, await statusesFor(task.list?.id)));
  }

  return {
    open,
    // Fetches one ticket directly, for tickets that dropped out of the "open and assigned" query.
    async fetchOne(id: string): Promise<RemoteTicket | null> {
      try {
        const task = taskSchema.parse(await get(`/task/${id}?include_markdown_description=true`));
        return toTicket(task, await statusesFor(task.list?.id));
      } catch (error) {
        if (error instanceof HttpError && (error.status === 404 || error.status === 401)) return null;
        throw error;
      }
    },
  };
}

async function listStatuses(get: (path: string) => Promise<unknown>, listId: string) {
  try {
    const list = z.object({ statuses: z.array(statusSchema) }).parse(await get(`/list/${listId}`));
    return list.statuses.map((status) => ({ name: status.status, group: groupFor(status) }));
  } catch (error) {
    console.error(`Could not read statuses for ClickUp list ${listId}`, String(error));
    return [];
  }
}

export async function testClickUp(token: string): Promise<string> {
  const user = z
    .object({ user: z.object({ username: z.string().nullable().optional(), email: z.string().optional() }) })
    .parse(await client(token)("/user"));
  return `Connected to ClickUp as ${user.user.username ?? user.user.email ?? "unknown user"}.`;
}
