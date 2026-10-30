// Fictional sample data for demo mode: screenshots and trying the plugin without accounts.
// Dates are relative to today, so the data always looks current.
import type { ProjectIssue, ProjectStatusType, ProjectSummary } from "../shared/projects";
import { type Cycle, type StatusGroup, suggestBranchName, type Task, type TicketStatus } from "../shared/tasks";
import { addToCounts, emptyCounts } from "./linear-projects";

const DAY = 86_400_000;
const ME = "Alex Morgan";

function day(offset: number): string {
  const date = new Date(Date.now() + offset * DAY);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function iso(offsetDays: number, offsetMinutes = 0): string {
  return new Date(Date.now() + offsetDays * DAY + offsetMinutes * 60_000).toISOString();
}

function cycle(number: number, startOffset: number): Cycle {
  return { number, name: null, startsAt: iso(startOffset), endsAt: iso(startOffset + 14) };
}

const PAST_CYCLE = () => cycle(41, -17);
const CURRENT_CYCLE = () => cycle(42, -3);
const NEXT_CYCLE = () => cycle(43, 11);

const LINEAR_STATES: Record<string, { group: StatusGroup; color: string }> = {
  Backlog: { group: "todo", color: "#bec2c8" },
  Todo: { group: "todo", color: "#e2e2e2" },
  "In Progress": { group: "in_progress", color: "#f2c94c" },
  "In Review": { group: "review", color: "#5e6ad2" },
  Done: { group: "done", color: "#4cb782" },
  Canceled: { group: "canceled", color: "#95a2b3" },
};
const LINEAR_STATUS_LIST: TicketStatus[] = Object.entries(LINEAR_STATES).map(([name, state]) => ({ name, group: state.group }));
const PRIORITY_LABELS = ["", "Urgent", "High", "Medium", "Low"];

// [title, state, priority 0-4, assignee ("me", a name, or null), due offset in days or null, milestone]
type IssueRow = [string, keyof typeof LINEAR_STATES, number, string | null, number | null, string?];

interface DemoProject {
  id: string;
  name: string;
  description: string;
  statusName: string;
  statusType: ProjectStatusType;
  health: ProjectSummary["health"];
  startOffset: number | null;
  targetOffset: number | null;
  lead: string;
  member: boolean;
  milestones: { name: string; targetOffset: number; progress: number }[];
  issues: IssueRow[];
}

const PROJECTS: DemoProject[] = [
  {
    id: "demo-project-mobile-offline",
    name: "Mobile offline mode",
    description:
      "Let field staff check in, add notes, and take photos without a connection. Changes queue on the device and sync when the network is back, with clear conflict handling.",
    statusName: "In Progress",
    statusType: "started",
    health: "atRisk",
    startOffset: -40,
    targetOffset: -3,
    lead: "me",
    member: true,
    milestones: [
      { name: "Offline read", targetOffset: -20, progress: 1 },
      { name: "Offline write and sync", targetOffset: 6, progress: 0.45 },
    ],
    issues: [
      ["Add offline queue for mobile check-ins", "In Review", 2, "me", 1, "Offline write and sync"],
      ["Resolve sync conflicts with a last-write-wins rule", "In Progress", 1, "me", 2, "Offline write and sync"],
      ["Retry photo uploads with exponential backoff", "In Progress", 2, "Leo Park", 4, "Offline write and sync"],
      ["Show a banner when the app is offline", "In Review", 3, "Priya Nair", null, "Offline write and sync"],
      ["Encrypt the local SQLite cache", "Todo", 2, "me", 8, "Offline write and sync"],
      ["Queue notes created while offline", "In Progress", 3, "Tom Becker", null, "Offline write and sync"],
      ["Add a manual Sync now button", "Todo", 4, null, null],
      ["Measure storage use on low-end Android devices", "Todo", 3, null, null],
      ["Write QA test plan for airplane mode", "Todo", 3, "Priya Nair", 5],
      ["Handle expired sessions after a long offline period", "Todo", 2, "Leo Park", null],
      ["Cache the job list for offline read", "Done", 2, "Leo Park", null, "Offline read"],
      ["Cache customer details for offline read", "Done", 3, "Tom Becker", null, "Offline read"],
      ["Add a network status hook", "Done", 3, "me", null, "Offline read"],
      ["Spike: compare WatermelonDB and SQLite", "Done", 4, "Leo Park", null],
      ["Offline read: release to beta testers", "Done", 2, "me", null, "Offline read"],
      ["Prefetch photos on Wi-Fi", "Canceled", 4, null, null],
    ],
  },
  {
    id: "demo-project-checkout",
    name: "Checkout redesign",
    description: "A one-page checkout with saved carts, Apple Pay, and clearer error messages, to lift conversion on mobile.",
    statusName: "In Progress",
    statusType: "started",
    health: "onTrack",
    startOffset: -30,
    targetOffset: 5,
    lead: "Maya Chen",
    member: true,
    milestones: [],
    issues: [
      ["Show saved carts on the checkout page", "In Progress", 2, "me", -2],
      ["Add Apple Pay to the payment step", "In Progress", 2, "Maya Chen", 3],
      ["Clearer error message for declined cards", "In Review", 3, "Sam Rivera", null],
      ["Move the promo code field below the total", "Todo", 4, null, null],
      ["Track checkout step drop-off in analytics", "Todo", 3, "Priya Nair", 4],
      ["Remove legacy coupon code path", "Done", 3, "me", null],
      ["New address form with autocomplete", "Done", 2, "Maya Chen", null],
      ["One-page layout for mobile", "Done", 2, "Maya Chen", null],
      ["Persist the cart across devices", "Done", 3, "Sam Rivera", null],
      ["Load the payment form lazily", "Done", 4, "Tom Becker", null],
      ["Design review: checkout v2", "Done", 3, "Maya Chen", null],
      ["Accessibility pass on the payment step", "Done", 3, "Priya Nair", null],
    ],
  },
  {
    id: "demo-project-billing",
    name: "Billing v2 migration",
    description:
      "Move all subscriptions from the old billing service to Billing v2, with no double charges and no missed invoices.",
    statusName: "In Progress",
    statusType: "started",
    health: "onTrack",
    startOffset: -14,
    targetOffset: 21,
    lead: "me",
    member: true,
    milestones: [
      { name: "Dual write", targetOffset: 7, progress: 0.6 },
      { name: "Cutover", targetOffset: 21, progress: 0 },
    ],
    issues: [
      ["Fix double charge when a payment retries after a timeout", "In Progress", 1, "me", 0, "Dual write"],
      ["Migrate invoice PDFs to the new renderer", "Todo", 3, "me", 6, "Dual write"],
      ["Backfill customer tax IDs", "In Progress", 2, "Sam Rivera", 5, "Dual write"],
      ["Dual-write subscription changes", "In Review", 2, "Tom Becker", null, "Dual write"],
      ["Reconcile old and new invoices every night", "Todo", 2, "me", null, "Dual write"],
      ["Feature flag for the cutover", "Todo", 3, null, null, "Cutover"],
      ["Runbook for the cutover weekend", "Todo", 3, "me", 18, "Cutover"],
      ["Email customers about the new invoice format", "Todo", 4, null, null, "Cutover"],
      ["Load test the webhook handler", "Todo", 3, "Tom Becker", null, "Cutover"],
      ["Remove the old billing cron jobs", "Backlog", 4, null, null, "Cutover"],
      ["Billing v2 data model", "Done", 2, "me", null],
      ["Stripe webhook signature check", "Done", 1, "Tom Becker", null],
      ["Proration rules for plan changes", "Done", 2, "Sam Rivera", null],
      ["Admin view for failed payments", "Canceled", 4, null, null],
    ],
  },
  {
    id: "demo-project-search",
    name: "Search relevance",
    description: "Better ranking for customer and job search, with typo tolerance and recent-first results.",
    statusName: "Planned",
    statusType: "planned",
    health: null,
    startOffset: 14,
    targetOffset: 45,
    lead: "Leo Park",
    member: true,
    milestones: [],
    issues: [
      ["Rate limit the public search endpoint", "Todo", 4, "me", null],
      ["Typo tolerance for customer names", "Todo", 2, "Leo Park", null],
      ["Boost recent jobs in results", "Backlog", 3, null, null],
      ["Search analytics dashboard", "Backlog", 4, null, null],
      ["Index job notes", "Backlog", 3, null, null],
      ["Spike: hosted search vs. Postgres full text", "Done", 3, "Leo Park", null],
    ],
  },
  {
    id: "demo-project-export",
    name: "Data export API",
    description: "A public API for exporting jobs and invoices, paused until Billing v2 ships.",
    statusName: "Paused",
    statusType: "paused",
    health: null,
    startOffset: -60,
    targetOffset: null,
    lead: "Sam Rivera",
    member: false,
    milestones: [],
    issues: [
      ["Export invoices as CSV", "Todo", 3, "Sam Rivera", null],
      ["API keys with read-only scope", "In Progress", 2, "Sam Rivera", null],
      ["Export jobs as JSON", "Done", 3, "Sam Rivera", null],
      ["Pagination for export endpoints", "Done", 3, "Tom Becker", null],
    ],
  },
  {
    id: "demo-project-onboarding",
    name: "Onboarding emails",
    description: "A five-email onboarding series for new workspaces. Live and being monitored.",
    statusName: "Monitoring",
    statusType: "started",
    health: "onTrack",
    startOffset: -50,
    targetOffset: -10,
    lead: "Maya Chen",
    member: true,
    milestones: [],
    issues: [
      ["Welcome email", "Done", 3, "Maya Chen", null],
      ["Day 3: invite your team", "Done", 3, "Maya Chen", null],
      ["Day 7: connect your calendar", "Done", 4, "Priya Nair", null],
      ["Unsubscribe link in all emails", "Done", 2, "me", null],
      ["Track open and click rates", "Done", 3, "Priya Nair", null],
    ],
  },
];

function buildIssues(project: DemoProject, firstNumber: number): ProjectIssue[] {
  return project.issues.map(([title, stateName, priority, assignee, dueOffset, milestone], index) => {
    const state = LINEAR_STATES[stateName];
    const identifier = `ENG-${firstNumber + index}`;
    const open = state.group !== "done" && state.group !== "canceled";
    return {
      id: `demo-issue-${identifier.toLowerCase()}`,
      identifier,
      title,
      description: `${title}.\n\nAcceptance criteria:\n- Works on iOS, Android, and web.\n- Covered by tests.\n- Release notes updated.`,
      url: `https://linear.app/acme/issue/${identifier}`,
      status: stateName,
      statusGroup: state.group,
      statusColor: state.color,
      priority: priority ? PRIORITY_LABELS[priority] : null,
      priorityRank: priority || null,
      dueDate: dueOffset === null ? null : day(dueOffset),
      cycle: open ? (stateName === "Backlog" ? null : priority >= 4 ? NEXT_CYCLE() : CURRENT_CYCLE()) : PAST_CYCLE(),
      assigneeName: assignee === "me" ? ME : assignee,
      assignedToMe: assignee === "me",
      milestone: milestone ?? null,
      estimate: [1, 2, 3, 5][index % 4],
      updatedAt: iso(-(index % 6), -index * 37),
    };
  });
}

function buildProjects() {
  let next = 301;
  return PROJECTS.map((project) => {
    const issues = buildIssues(project, next);
    next += project.issues.length + 7;
    const counts = emptyCounts();
    for (const issue of issues) {
      addToCounts(counts, issue.statusGroup, issue.assigneeName ? { isMe: issue.assignedToMe } : null);
    }
    const counted = counts.total - counts.canceled;
    const summary: ProjectSummary = {
      id: project.id,
      name: project.name,
      url: `https://linear.app/acme/project/${project.id.replace("demo-project-", "")}`,
      description: project.description,
      statusName: project.statusName,
      statusType: project.statusType,
      progress: counted ? counts.done / counted : 0,
      health: project.health,
      startDate: project.startOffset === null ? null : day(project.startOffset),
      targetDate: project.targetOffset === null ? null : day(project.targetOffset),
      leadName: project.lead === "me" ? ME : project.lead,
      isLead: project.lead === "me",
      isMember: project.member,
      counts,
    };
    const milestones = project.milestones.map((milestone) => ({
      name: milestone.name,
      targetDate: day(milestone.targetOffset),
      progress: milestone.progress,
    }));
    return { summary, milestones, issues };
  });
}

export function demoProjectList() {
  return { projects: buildProjects().map((project) => project.summary), fetchedAt: iso(0, -2) };
}

export function demoProject(projectId: string) {
  const project = buildProjects().find((entry) => entry.summary.id === projectId);
  if (!project) throw new Error("Demo project not found.");
  return { project: project.summary, milestones: project.milestones, issues: project.issues, fetchedAt: iso(0, -2) };
}

function baseTask(): Omit<Task, "id" | "source" | "title" | "status" | "statusGroup"> {
  return {
    externalId: null,
    identifier: null,
    description: "",
    url: null,
    statusColor: null,
    availableStatuses: [],
    container: null,
    priority: null,
    priorityRank: null,
    dueDate: null,
    cycle: null,
    project: null,
    createdAt: iso(-10),
    updatedAt: iso(-1),
    syncedAt: iso(0, -4),
    missing: false,
    assignments: [],
  };
}

const CLICKUP_STATUSES: TicketStatus[] = [
  { name: "to do", group: "todo" },
  { name: "in progress", group: "in_progress" },
  { name: "review", group: "review" },
  { name: "complete", group: "done" },
];

export function demoTasks(): Task[] {
  // Your Linear tasks are the demo project issues assigned to you, so both views agree.
  const linear: Task[] = buildProjects().flatMap(({ summary, issues }) =>
    issues
      .filter((issue) => issue.assignedToMe)
      .map((issue) => ({
        ...baseTask(),
        id: `linear:${issue.id}`,
        source: "linear" as const,
        externalId: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        url: issue.url,
        status: issue.status,
        statusGroup: issue.statusGroup,
        statusColor: issue.statusColor,
        availableStatuses: LINEAR_STATUS_LIST,
        container: "Engineering",
        priority: issue.priority,
        priorityRank: issue.priorityRank,
        dueDate: issue.dueDate,
        cycle: issue.cycle,
        project: { id: summary.id, name: summary.name },
        updatedAt: issue.updatedAt,
      })),
  );

  const doubleCharge = linear.find((task) => task.title.startsWith("Fix double charge"));
  if (doubleCharge) {
    doubleCharge.assignments = [
      {
        agentId: "demo-agent",
        workspaceId: "demo-workspace",
        projectName: "acme/billing-service",
        mode: "worktree",
        branch: suggestBranchName(doubleCharge),
        provider: "claude/claude-opus-5-5",
        createdAt: iso(0, -25),
      },
    ];
  }

  const clickup: Task[] = [
    {
      ...baseTask(),
      id: "clickup:demo-1",
      source: "clickup",
      externalId: "demo-1",
      title: "Update pricing page copy for the new plans",
      description: "Use the approved copy from the launch doc. Keep the comparison table.",
      url: "https://app.clickup.com/t/demo-1",
      status: "in progress",
      statusGroup: "in_progress",
      statusColor: "#5f55ee",
      availableStatuses: CLICKUP_STATUSES,
      container: "Marketing site",
      priority: "High",
      priorityRank: 2,
      dueDate: iso(3),
    },
    {
      ...baseTask(),
      id: "clickup:demo-2",
      source: "clickup",
      externalId: "demo-2",
      title: "Customer request: export reports to CSV",
      description: "Three customers asked for this in October. Start with the monthly summary report.",
      url: "https://app.clickup.com/t/demo-2",
      status: "to do",
      statusGroup: "todo",
      statusColor: "#87909e",
      availableStatuses: CLICKUP_STATUSES,
      container: "Customer requests",
      priority: "Normal",
      priorityRank: 3,
      dueDate: iso(10),
    },
    {
      ...baseTask(),
      id: "clickup:demo-3",
      source: "clickup",
      externalId: "demo-3",
      title: "Fix broken links in the help center",
      description: "The link checker found 14 broken links after the docs move.",
      url: "https://app.clickup.com/t/demo-3",
      status: "review",
      statusGroup: "review",
      statusColor: "#f8ae00",
      availableStatuses: CLICKUP_STATUSES,
      container: "Support",
      priority: "Low",
      priorityRank: 4,
      dueDate: iso(-1),
    },
  ];

  const manual: Task[] = [
    {
      ...baseTask(),
      id: "manual:demo-1",
      source: "manual",
      title: "Reply to the Slack thread about the SSO rollout",
      description: "Confirm the rollout date with the security team and share the checklist.",
      url: "https://example.slack.com/archives/C000000/p1000000000",
      status: "To do",
      statusGroup: "todo",
    },
    {
      ...baseTask(),
      id: "manual:demo-2",
      source: "manual",
      title: "Prepare the demo for Friday's product review",
      description: "Show offline check-ins and the new checkout.",
      status: "In progress",
      statusGroup: "in_progress",
    },
  ];

  return [...linear, ...clickup, ...manual];
}
