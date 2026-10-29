import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { cycleSchema, statusGroupSchema } from "./tasks";

export const projectHealthSchema = z.enum(["onTrack", "atRisk", "offTrack"]);
export type ProjectHealth = z.infer<typeof projectHealthSchema>;

// Linear project status types.
export const projectStatusTypeSchema = z.enum(["backlog", "planned", "started", "paused", "completed", "canceled"]);
export type ProjectStatusType = z.infer<typeof projectStatusTypeSchema>;

export const projectCountsSchema = z.object({
  total: z.number(),
  todo: z.number(),
  inProgress: z.number(),
  review: z.number(),
  done: z.number(),
  canceled: z.number(),
  // Open issues assigned to you.
  mine: z.number(),
  // Open issues with no assignee.
  unassigned: z.number(),
});
export type ProjectCounts = z.infer<typeof projectCountsSchema>;

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  description: z.string(),
  statusName: z.string(),
  statusType: projectStatusTypeSchema,
  // 0 to 1, as Linear computes it (weighted by estimates).
  progress: z.number(),
  health: projectHealthSchema.nullable(),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  leadName: z.string().nullable(),
  isLead: z.boolean(),
  isMember: z.boolean(),
  counts: projectCountsSchema,
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const projectIssueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string(),
  status: z.string(),
  statusGroup: statusGroupSchema,
  statusColor: z.string().nullable(),
  priority: z.string().nullable(),
  priorityRank: z.number().nullable(),
  dueDate: z.string().nullable(),
  cycle: cycleSchema.nullable(),
  assigneeName: z.string().nullable(),
  assignedToMe: z.boolean(),
  milestone: z.string().nullable(),
  estimate: z.number().nullable(),
  updatedAt: z.string(),
});
export type ProjectIssue = z.infer<typeof projectIssueSchema>;

export const milestoneSchema = z.object({
  name: z.string(),
  targetDate: z.string().nullable(),
  progress: z.number(),
});

export const listProjectsRpc = defineRpc({
  name: "projects.list",
  // force skips the short server cache, for the Refresh button.
  input: z.object({ force: z.boolean() }),
  output: z.object({ projects: z.array(projectSummarySchema), fetchedAt: z.string() }),
});

export const getProjectRpc = defineRpc({
  name: "projects.get",
  input: z.object({ projectId: z.string(), force: z.boolean() }),
  output: z.object({
    project: projectSummarySchema,
    milestones: z.array(milestoneSchema),
    issues: z.array(projectIssueSchema),
    fetchedAt: z.string(),
  }),
});

export const HEALTH_LABELS: Record<ProjectHealth, string> = {
  onTrack: "On track",
  atRisk: "At risk",
  offTrack: "Off track",
};
