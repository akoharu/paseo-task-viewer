import { splitList } from "../shared/settings";
import { isOpenStatus, type SyncState, type Task, type TaskSource } from "../shared/tasks";
import { fetchClickUp } from "./clickup";
import { getToken } from "./credentials";
import { fetchLinear } from "./linear";
import type { RemoteTicket } from "./remote";
import { mutateTasks, readTasks } from "./store";

export interface SyncPreferences {
  clickupEnabled: boolean;
  clickupTeamIds: string;
  clickupListIds: string;
  linearEnabled: boolean;
  linearTeamKeys: string;
}

// Finished synced tickets with no agent are dropped after this long.
const DONE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
// Upper bound on single-ticket lookups per sync, to stay inside ClickUp rate limits.
const MAX_SINGLE_LOOKUPS = 40;

const state: SyncState = { running: false, lastRunAt: null, lastSuccessAt: null, errors: [] };
let inFlight: Promise<void> | null = null;

export function getSyncState(): SyncState {
  return { ...state, errors: [...state.errors] };
}

export function syncNow(preferences: SyncPreferences): Promise<void> {
  if (!inFlight) {
    inFlight = runSync(preferences).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

interface SourceResult {
  source: TaskSource;
  open: RemoteTicket[];
  // Tickets we already had that were not in the open list, refreshed one by one.
  refreshed: RemoteTicket[];
  // External IDs we looked up and could not find.
  missing: string[];
}

async function runSync(preferences: SyncPreferences): Promise<void> {
  state.running = true;
  state.lastRunAt = new Date().toISOString();
  const errors: string[] = [];
  const known = await readTasks();
  const results: SourceResult[] = [];

  const staleIds = (source: TaskSource, open: RemoteTicket[]) => {
    const openIds = new Set(open.map((ticket) => ticket.externalId));
    return known
      .filter(
        (task) =>
          task.source === source &&
          task.externalId &&
          !openIds.has(task.externalId) &&
          isOpenStatus(task.statusGroup) &&
          !task.missing,
      )
      .map((task) => task.externalId as string)
      .slice(0, MAX_SINGLE_LOOKUPS);
  };

  if (preferences.clickupEnabled) {
    const credential = await getToken("clickup");
    if (credential) {
      try {
        const clickup = await fetchClickUp(credential.token, {
          teamIds: splitList(preferences.clickupTeamIds),
          listIds: splitList(preferences.clickupListIds),
        });
        const refreshed: RemoteTicket[] = [];
        const missing: string[] = [];
        for (const id of staleIds("clickup", clickup.open)) {
          const ticket = await clickup.fetchOne(id);
          if (ticket) refreshed.push(ticket);
          else missing.push(id);
        }
        results.push({ source: "clickup", open: clickup.open, refreshed, missing });
      } catch (error) {
        errors.push(`ClickUp: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (preferences.linearEnabled) {
    const credential = await getToken("linear");
    if (credential) {
      try {
        const linear = await fetchLinear(credential.token, splitList(preferences.linearTeamKeys));
        const stale = staleIds("linear", linear.open);
        const refreshed = await linear.fetchMany(stale);
        const found = new Set(refreshed.map((ticket) => ticket.externalId));
        results.push({
          source: "linear",
          open: linear.open,
          refreshed,
          missing: stale.filter((id) => !found.has(id)),
        });
      } catch (error) {
        errors.push(`Linear: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  try {
    await mutateTasks((tasks) => ({ tasks: merge(tasks, results), result: undefined }));
  } catch (error) {
    errors.push(`Saving tasks: ${error instanceof Error ? error.message : String(error)}`);
  }

  state.running = false;
  state.errors = errors;
  if (errors.length === 0) state.lastSuccessAt = state.lastRunAt;
  for (const message of errors) console.error("Sync error", message);
}

function merge(tasks: Task[], results: SourceResult[]): Task[] {
  const now = new Date().toISOString();
  const byKey = new Map(tasks.map((task) => [task.id, task]));

  for (const result of results) {
    const entries = [
      ...result.open.map((ticket) => ({ ticket, inQueue: true })),
      // A refreshed ticket that is still open was unassigned or filtered out, so flag it.
      ...result.refreshed.map((ticket) => ({ ticket, inQueue: !isOpenStatus(ticket.statusGroup) })),
    ];
    for (const { ticket, inQueue } of entries) {
      const id = `${result.source}:${ticket.externalId}`;
      const existing = byKey.get(id);
      const { remoteUpdatedAt, ...fields } = ticket;
      byKey.set(id, {
        id,
        source: result.source,
        ...fields,
        createdAt: existing?.createdAt ?? now,
        updatedAt: remoteUpdatedAt ?? now,
        syncedAt: now,
        missing: !inQueue,
        assignments: existing?.assignments ?? [],
      });
    }
    for (const externalId of result.missing) {
      const existing = byKey.get(`${result.source}:${externalId}`);
      if (existing) byKey.set(existing.id, { ...existing, missing: true, syncedAt: now });
    }
  }

  const cutoff = Date.now() - DONE_RETENTION_MS;
  return [...byKey.values()].filter(
    (task) =>
      task.source === "manual" ||
      task.assignments.length > 0 ||
      (isOpenStatus(task.statusGroup) && !task.missing) ||
      Date.parse(task.updatedAt) > cutoff,
  );
}
