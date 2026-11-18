import type { ProjectIssue } from "./projects";
import { cycleState, type Cycle, isOpenStatus, parseDueDate, type StatusGroup, type Task } from "./tasks";

// The fields ranking needs, shared by synced tasks and project issues.
export interface Rankable {
  statusGroup: StatusGroup;
  priorityRank: number | null;
  dueDate: string | null;
  cycle: Cycle | null;
  updatedAt: string;
  // When the ticket was created in its source app, or locally for manual tasks.
  created: string | null;
}

export function rankableTask(task: Task): Rankable {
  return { ...task, created: task.remoteCreatedAt ?? (task.source === "manual" ? task.createdAt : null) };
}

export function rankableIssue(issue: ProjectIssue): Rankable {
  return { ...issue, created: issue.createdAt };
}

export type ReasonKind =
  | "overdue"
  | "due-today"
  | "due-tomorrow"
  | "urgent"
  | "due-soon"
  | "in-progress"
  | "high"
  | "current-cycle"
  | "in-review";

export interface Recommendation {
  score: number;
  reason: { kind: ReasonKind; label: string } | null;
}

const DAY = 86_400_000;
// A ticket is stale when it is open, at least this old, and nobody touched it for a while.
export const STALE_AGE_DAYS = 30;
export const STALE_IDLE_DAYS = 14;

function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function daysUntilDue(item: Pick<Rankable, "dueDate">, now = Date.now()): number | null {
  if (!item.dueDate) return null;
  const due = parseDueDate(item.dueDate).getTime();
  if (Number.isNaN(due)) return null;
  return Math.round((startOfDay(due) - startOfDay(now)) / DAY);
}

export function daysSince(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : Math.max(0, Math.floor((now - time) / DAY));
}

// "today", "5 d", "3 mo", "2 y"
export function ageLabel(days: number): string {
  if (days < 1) return "today";
  if (days < 60) return `${days} d`;
  if (days < 365) return `${Math.floor(days / 30)} mo`;
  return `${Math.floor(days / 365)} y`;
}

export function isStale(item: Rankable, now = Date.now()): boolean {
  if (!isOpenStatus(item.statusGroup)) return false;
  const age = daysSince(item.created, now);
  const idle = daysSince(item.updatedAt, now);
  return age !== null && idle !== null && age >= STALE_AGE_DAYS && idle >= STALE_IDLE_DAYS;
}

const PRIORITY_SCORE: Record<number, number> = { 1: 40, 2: 30, 3: 20, 4: 10 };

// What to work on next: deadlines first, then priority, then work already started.
// Tickets waiting in review rank lower, because the next step is usually someone else's.
export function recommend(item: Rankable, now = Date.now()): Recommendation {
  if (!isOpenStatus(item.statusGroup)) return { score: -1000, reason: null };
  const due = daysUntilDue(item, now);
  const priority = item.priorityRank;
  const currentCycle = item.cycle ? cycleState(item.cycle, now) === "current" : false;

  let score = priority ? PRIORITY_SCORE[priority] : 12;
  if (due !== null) {
    if (due < 0) score += 50 + Math.min(-due, 14);
    else if (due === 0) score += 42;
    else if (due === 1) score += 34;
    else if (due <= 3) score += 24;
    else if (due <= 7) score += 14;
  }
  if (item.statusGroup === "in_progress") score += 10;
  if (item.statusGroup === "review") score -= 20;
  if (currentCycle) score += 6;

  let reason: Recommendation["reason"] = null;
  if (due !== null && due < 0) reason = { kind: "overdue", label: `Overdue ${-due} d` };
  else if (due === 0) reason = { kind: "due-today", label: "Due today" };
  else if (due === 1) reason = { kind: "due-tomorrow", label: "Due tomorrow" };
  else if (priority === 1) reason = { kind: "urgent", label: "Urgent" };
  else if (due !== null && due <= 3) reason = { kind: "due-soon", label: `Due in ${due} d` };
  else if (item.statusGroup === "review") reason = { kind: "in-review", label: "Waiting on review" };
  else if (item.statusGroup === "in_progress") reason = { kind: "in-progress", label: "Already started" };
  else if (priority === 2) reason = { kind: "high", label: "High priority" };
  else if (currentCycle) reason = { kind: "current-cycle", label: "Current cycle" };
  return { score, reason };
}

// Safe with Infinity on both sides, unlike a - b.
function compare(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function dueTime(item: Rankable): number {
  return item.dueDate ? parseDueDate(item.dueDate).getTime() : Infinity;
}

function createdTime(item: Rankable): number {
  const time = item.created ? Date.parse(item.created) : Number.NaN;
  return Number.isNaN(time) ? Infinity : time;
}

// Open work by recommendation; finished work after it, most recently updated first.
export function compareRecommended(a: Rankable, b: Rankable, now = Date.now()): number {
  const score = compare(recommend(b, now).score, recommend(a, now).score);
  if (score !== 0) return score;
  if (!isOpenStatus(a.statusGroup)) return compare(Date.parse(b.updatedAt), Date.parse(a.updatedAt));
  return compare(dueTime(a), dueTime(b)) || compare(createdTime(a), createdTime(b));
}

// Urgent first, no priority last, then the closest due date, then the oldest.
export function comparePriority(a: Rankable, b: Rankable): number {
  return (
    compare(a.priorityRank ?? 5, b.priorityRank ?? 5) ||
    compare(dueTime(a), dueTime(b)) ||
    compare(createdTime(a), createdTime(b))
  );
}

export function compareOldest(a: Rankable, b: Rankable): number {
  return compare(createdTime(a), createdTime(b));
}
