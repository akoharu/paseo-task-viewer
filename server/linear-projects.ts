import { z } from "zod";
import {
  type ProjectCounts,
  type ProjectIssue,
  type ProjectSummary,
  projectHealthSchema,
  projectStatusTypeSchema,
} from "../shared/projects";
import type { StatusGroup } from "../shared/tasks";
import { getToken } from "./credentials";
import { groupForState, linearClient } from "./linear";

// Short cache, so moving between screens does not call Linear every time. Refresh skips it.
const CACHE_MS = 60_000;
const MAX_PAGES = 8;

const OPEN_ISSUE_TYPES = ["completed", "canceled", "duplicate"];

const PROJECT_FIELDS = `
  id name url description progress health startDate targetDate
  status { name type }
  lead { name isMe }
  members { nodes { isMe } }
`;

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  description: z.string().nullable().optional(),
  progress: z.number(),
  health: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  status: z.object({ name: z.string(), type: z.string() }),
  lead: z.object({ name: z.string(), isMe: z.boolean() }).nullable().optional(),
  members: z.object({ nodes: z.array(z.object({ isMe: z.boolean() })) }),
});
type LinearProject = z.infer<typeof projectSchema>;

const pageInfoSchema = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });
const stateSchema = z.object({ name: z.string(), type: z.string(), color: z.string().nullable().optional() });

const countIssueSchema = z.object({
  project: z.object({ id: z.string() }).nullable().optional(),
  state: stateSchema,
  assignee: z.object({ isMe: z.boolean() }).nullable().optional(),
});

const issueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  url: z.string(),
  priority: z.number().int().min(0).max(4),
  priorityLabel: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimate: z.number().nullable().optional(),
  updatedAt: z.string(),
  state: stateSchema,
  assignee: z.object({ name: z.string(), displayName: z.string().nullable().optional(), isMe: z.boolean() }).nullable().optional(),
  cycle: z
    .object({ number: z.number(), name: z.string().nullable().optional(), startsAt: z.string(), endsAt: z.string() })
    .nullable()
    .optional(),
  projectMilestone: z.object({ name: z.string() }).nullable().optional(),
});

async function requireClient() {
  const credential = await getToken("linear");
  if (!credential) throw new Error("Linear is not connected. Add a Linear API key in Task viewer settings.");
  return linearClient(credential.token);
}

function emptyCounts(): ProjectCounts {
  return { total: 0, todo: 0, inProgress: 0, review: 0, done: 0, canceled: 0, mine: 0, unassigned: 0 };
}

function addToCounts(counts: ProjectCounts, group: StatusGroup, assignee: { isMe: boolean } | null | undefined) {
  counts.total += 1;
  if (group === "todo") counts.todo += 1;
  else if (group === "in_progress") counts.inProgress += 1;
  else if (group === "review") counts.review += 1;
  else if (group === "done") counts.done += 1;
  else counts.canceled += 1;
  if (group !== "done" && group !== "canceled") {
    if (assignee?.isMe) counts.mine += 1;
    if (!assignee) counts.unassigned += 1;
  }
}

function toSummary(project: LinearProject, counts: ProjectCounts): ProjectSummary {
  const statusType = projectStatusTypeSchema.safeParse(project.status.type);
  const health = projectHealthSchema.safeParse(project.health);
  return {
    id: project.id,
    name: project.name,
    url: project.url,
    description: project.description ?? "",
    statusName: project.status.name,
    statusType: statusType.success ? statusType.data : "started",
    progress: project.progress,
    health: health.success ? health.data : null,
    startDate: project.startDate ?? null,
    targetDate: project.targetDate ?? null,
    leadName: project.lead?.name ?? null,
    isLead: project.lead?.isMe ?? false,
    isMember: project.members.nodes.some((member) => member.isMe),
    counts,
  };
}

let listCache: { at: number; value: { projects: ProjectSummary[]; fetchedAt: string } } | null = null;
const detailCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof fetchProject>> }>();

// Active projects you lead, are a member of, or have open issues in.
export async function listProjects(force: boolean) {
  if (!force && listCache && Date.now() - listCache.at < CACHE_MS) return listCache.value;
  const query = await requireClient();
  const viewer = z.object({ viewer: z.object({ id: z.string() }) }).parse(await query("query { viewer { id } }", {}));
  const me = viewer.viewer.id;

  const projects: LinearProject[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = z
      .object({ projects: z.object({ nodes: z.array(projectSchema), pageInfo: pageInfoSchema }) })
      .parse(
        await query(
          `query($me: ID!, $after: String, $open: [String!]) {
            projects(first: 50, after: $after, filter: {
              status: { type: { nin: ["completed", "canceled"] } },
              or: [
                { lead: { id: { eq: $me } } },
                { members: { id: { eq: $me } } },
                { issues: { assignee: { id: { eq: $me } }, state: { type: { nin: $open } } } }
              ]
            }) { nodes { ${PROJECT_FIELDS} } pageInfo { hasNextPage endCursor } }
          }`,
          { me, after, open: OPEN_ISSUE_TYPES },
        ),
      );
    projects.push(...data.projects.nodes);
    if (!data.projects.pageInfo.hasNextPage) break;
    after = data.projects.pageInfo.endCursor;
  }

  // Count issues per project in one paged query, instead of one query per project.
  const counts = new Map(projects.map((project) => [project.id, emptyCounts()]));
  after = null;
  for (let page = 0; page < MAX_PAGES && projects.length > 0; page += 1) {
    const data = z
      .object({ issues: z.object({ nodes: z.array(countIssueSchema), pageInfo: pageInfoSchema }) })
      .parse(
        await query(
          `query($ids: [ID!], $after: String) {
            issues(first: 250, after: $after, filter: { project: { id: { in: $ids } } }) {
              nodes { project { id } state { name type } assignee { isMe } }
              pageInfo { hasNextPage endCursor }
            }
          }`,
          { ids: projects.map((project) => project.id), after },
        ),
      );
    for (const issue of data.issues.nodes) {
      const bucket = issue.project ? counts.get(issue.project.id) : undefined;
      if (bucket) addToCounts(bucket, groupForState(issue.state), issue.assignee);
    }
    if (!data.issues.pageInfo.hasNextPage) break;
    after = data.issues.pageInfo.endCursor;
  }

  const value = {
    projects: projects.map((project) => toSummary(project, counts.get(project.id) ?? emptyCounts())),
    fetchedAt: new Date().toISOString(),
  };
  listCache = { at: Date.now(), value };
  return value;
}

async function fetchProject(projectId: string) {
  const query = await requireClient();
  const head = z
    .object({
      project: projectSchema.extend({
        projectMilestones: z.object({
          nodes: z.array(z.object({ name: z.string(), targetDate: z.string().nullable().optional(), progress: z.number() })),
        }),
      }),
    })
    .parse(
      await query(
        `query($id: String!) { project(id: $id) {
          ${PROJECT_FIELDS}
          projectMilestones { nodes { name targetDate progress } }
        } }`,
        { id: projectId },
      ),
    );

  const issues: ProjectIssue[] = [];
  const counts = emptyCounts();
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = z
      .object({ project: z.object({ issues: z.object({ nodes: z.array(issueSchema), pageInfo: pageInfoSchema }) }) })
      .parse(
        await query(
          `query($id: String!, $after: String) { project(id: $id) {
            issues(first: 100, after: $after) {
              nodes {
                id identifier title description url priority priorityLabel dueDate estimate updatedAt
                state { name type color }
                assignee { name displayName isMe }
                cycle { number name startsAt endsAt }
                projectMilestone { name }
              }
              pageInfo { hasNextPage endCursor }
            }
          } }`,
          { id: projectId, after },
        ),
      );
    for (const issue of data.project.issues.nodes) {
      const group = groupForState(issue.state);
      addToCounts(counts, group, issue.assignee);
      issues.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? "",
        url: issue.url,
        status: issue.state.name,
        statusGroup: group,
        statusColor: issue.state.color ?? null,
        priority: issue.priority === 0 ? null : (issue.priorityLabel ?? null),
        priorityRank: issue.priority === 0 ? null : issue.priority,
        dueDate: issue.dueDate ?? null,
        cycle: issue.cycle
          ? { number: issue.cycle.number, name: issue.cycle.name ?? null, startsAt: issue.cycle.startsAt, endsAt: issue.cycle.endsAt }
          : null,
        assigneeName: issue.assignee ? issue.assignee.displayName || issue.assignee.name : null,
        assignedToMe: issue.assignee?.isMe ?? false,
        milestone: issue.projectMilestone?.name ?? null,
        estimate: issue.estimate ?? null,
        updatedAt: issue.updatedAt,
      });
    }
    if (!data.project.issues.pageInfo.hasNextPage) break;
    after = data.project.issues.pageInfo.endCursor;
  }

  return {
    project: toSummary(head.project, counts),
    milestones: head.project.projectMilestones.nodes.map((milestone) => ({
      name: milestone.name,
      targetDate: milestone.targetDate ?? null,
      progress: milestone.progress,
    })),
    issues,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getProject(projectId: string, force: boolean) {
  const cached = detailCache.get(projectId);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = await fetchProject(projectId);
  detailCache.set(projectId, { at: Date.now(), value });
  return value;
}
