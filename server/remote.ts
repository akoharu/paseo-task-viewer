import type { Task } from "../shared/tasks";

// The fields a ticket system owns. Local fields (assignments, timestamps) are kept on sync.
export type RemoteTicket = Pick<
  Task,
  | "identifier"
  | "title"
  | "description"
  | "url"
  | "status"
  | "statusGroup"
  | "statusColor"
  | "availableStatuses"
  | "container"
  | "priority"
  | "priorityRank"
  | "dueDate"
  | "cycle"
  | "project"
> & { externalId: string; remoteUpdatedAt: string | null };

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requestJson(url: string, init: RequestInit, label: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(response.status, `${label} returned ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

// Status names that mean "waiting on review or verification", in ClickUp and Linear workflows.
export function looksLikeReview(name: string): boolean {
  return /review|merge request|pull request|\bpr\b|\bqa\b|test|verif|approv|ready for prod/i.test(name);
}
