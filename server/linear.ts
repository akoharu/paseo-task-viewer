import { z } from "zod";
import type { StatusGroup } from "../shared/tasks";
import { looksLikeReview, type RemoteTicket, requestJson } from "./remote";

const API = "https://api.linear.app/graphql";

const ISSUE_FIELDS = `
  id identifier title description url priority priorityLabel dueDate updatedAt
  cycle { number name startsAt endsAt }
  project { id name }
  state { name type color }
  team { key name states { nodes { name type position } } }
`;

const stateSchema = z.object({ name: z.string(), type: z.string(), color: z.string().nullable().optional() });
const issueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  url: z.string(),
  // 0 = no priority, 1 = urgent, 2 = high, 3 = medium, 4 = low.
  priority: z.number().int().min(0).max(4),
  priorityLabel: z.string().nullable().optional(),
  cycle: z
    .object({ number: z.number(), name: z.string().nullable().optional(), startsAt: z.string(), endsAt: z.string() })
    .nullable()
    .optional(),
  dueDate: z.string().nullable().optional(),
  updatedAt: z.string(),
  project: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  state: stateSchema,
  team: z.object({
    key: z.string(),
    name: z.string(),
    states: z.object({
      nodes: z.array(z.object({ name: z.string(), type: z.string(), position: z.number() })),
    }),
  }),
});
type LinearIssue = z.infer<typeof issueSchema>;

export function linearClient(token: string) {
  return async (query: string, variables: Record<string, unknown>) => {
    const body = z
      .object({
        data: z.unknown().optional(),
        errors: z.array(z.object({ message: z.string() })).optional(),
      })
      .parse(
        await requestJson(
          API,
          {
            method: "POST",
            headers: { Authorization: token, "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables }),
          },
          "Linear",
        ),
      );
    if (body.errors?.length) throw new Error(`Linear: ${body.errors.map((e) => e.message).join("; ")}`);
    return body.data;
  };
}

function groupFor(type: string): StatusGroup {
  switch (type) {
    case "started":
      return "in_progress";
    case "completed":
      return "done";
    case "canceled":
    case "duplicate":
      return "canceled";
    default:
      return "todo";
  }
}

// Linear has no review type, so a started state named like "In Review" or "Merge Request" counts as review.
export function groupForState(state: { name: string; type: string }): StatusGroup {
  return state.type === "started" && looksLikeReview(state.name) ? "review" : groupFor(state.type);
}

function toTicket(issue: LinearIssue): RemoteTicket {
  const states = [...issue.team.states.nodes].sort((a, b) => a.position - b.position);
  return {
    externalId: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? "",
    url: issue.url,
    status: issue.state.name,
    statusGroup: groupForState(issue.state),
    statusColor: issue.state.color ?? null,
    availableStatuses: states.map((state) => ({ name: state.name, group: groupForState(state) })),
    container: issue.team.name,
    priority: issue.priority === 0 ? null : (issue.priorityLabel ?? null),
    priorityRank: issue.priority === 0 ? null : issue.priority,
    dueDate: issue.dueDate ?? null,
    cycle: issue.cycle
      ? {
          number: issue.cycle.number,
          name: issue.cycle.name ?? null,
          startsAt: issue.cycle.startsAt,
          endsAt: issue.cycle.endsAt,
        }
      : null,
    project: issue.project ? { id: issue.project.id, name: issue.project.name } : null,
    remoteUpdatedAt: issue.updatedAt,
  };
}

export async function fetchLinear(token: string, teamKeys: string[]) {
  const query = linearClient(token);
  const filter: Record<string, unknown> = {
    state: { type: { nin: ["completed", "canceled", "duplicate"] } },
  };
  if (teamKeys.length > 0) filter.team = { key: { in: teamKeys } };

  const open: RemoteTicket[] = [];
  let after: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const data = z
      .object({
        viewer: z.object({
          assignedIssues: z.object({
            nodes: z.array(issueSchema),
            pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
          }),
        }),
      })
      .parse(
        await query(
          `query($after: String, $filter: IssueFilter) {
            viewer { assignedIssues(first: 100, after: $after, filter: $filter) {
              nodes { ${ISSUE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            } }
          }`,
          { after, filter },
        ),
      );
    open.push(...data.viewer.assignedIssues.nodes.map(toTicket));
    if (!data.viewer.assignedIssues.pageInfo.hasNextPage) break;
    after = data.viewer.assignedIssues.pageInfo.endCursor;
  }

  return {
    open,
    // Fetches tickets that dropped out of the open query, in one request.
    async fetchMany(ids: string[]): Promise<RemoteTicket[]> {
      if (ids.length === 0) return [];
      const data = z
        .object({ issues: z.object({ nodes: z.array(issueSchema) }) })
        .parse(
          await query(
            `query($ids: [ID!]) { issues(first: 100, filter: { id: { in: $ids } }) { nodes { ${ISSUE_FIELDS} } } }`,
            { ids },
          ),
        );
      return data.issues.nodes.map(toTicket);
    },
  };
}

export async function testLinear(token: string): Promise<string> {
  const data = z
    .object({ viewer: z.object({ name: z.string(), email: z.string().optional() }) })
    .parse(await linearClient(token)("query { viewer { name email } }", {}));
  return `Connected to Linear as ${data.viewer.name}.`;
}
