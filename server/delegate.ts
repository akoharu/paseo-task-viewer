import type { RpcInput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import {
  type Assignment,
  type delegateTaskRpc,
  SOURCE_LABELS,
  STATUS_GROUP_LABELS,
  type StatusGroup,
  type Task,
} from "../shared/tasks";
import { mutateTasks, readTasks } from "./store";

type DelegateInput = RpcInput<typeof delegateTaskRpc>;
type PaseoApi = PluginHandlerContext["paseo"];
type PaseoWorkspaceHandle = Awaited<ReturnType<PaseoApi["workspaces"]["open"]>>;

function pickStatus(task: Task, group: StatusGroup): string | null {
  return task.availableStatuses.find((status) => status.group === group)?.name ?? null;
}

function statusRules(task: Task): string {
  if (task.source === "manual") {
    return [
      "## Ticket status",
      "This is a manual task. It is not tracked in ClickUp or Linear, so there is no ticket status to update.",
    ].join("\n");
  }

  const system = SOURCE_LABELS[task.source];
  const statuses = task.availableStatuses.length
    ? task.availableStatuses.map((status) => `- "${status.name}" (${STATUS_GROUP_LABELS[status.group]})`).join("\n")
    : "- (not known, read them from the ticket before you change it)";
  const inProgress = pickStatus(task, "in_progress");
  const review = pickStatus(task, "review");
  const idLine =
    task.source === "clickup"
      ? `ClickUp task ID: ${task.externalId}${task.identifier ? ` (custom ID ${task.identifier})` : ""}`
      : `Linear issue: ${task.identifier} (ID ${task.externalId})`;

  return [
    "## Ticket status (required)",
    `This ticket is tracked in ${system}. ${system} is the source of truth for its status.`,
    `Update the ticket yourself with the ${system} MCP tools or the ${system} API, whichever you have access to.`,
    "",
    idLine,
    `Current status: "${task.status}"`,
    "Statuses this ticket can use (use the exact name):",
    statuses,
    "",
    "Rules:",
    `1. When you start work, move the ticket to ${inProgress ? `"${inProgress}"` : "an in-progress status"} if it is not already there or further along.`,
    `2. When the work is ready for review (for example a PR is open), move it to ${review ? `"${review}"` : "a review status if one exists, otherwise leave it in progress"}.`,
    "3. Do not move the ticket to a done, closed, or canceled status unless the user tells you to.",
    "4. When you finish, add a short comment on the ticket: what you changed, and the branch or PR link.",
    "5. Use only the status names listed above. Do not create new statuses.",
    `6. If you cannot reach ${system} (no MCP tool, no API token, or an error), continue the coding work and say clearly in your final message that the ticket status was not updated.`,
  ].join("\n");
}

export function buildPrompt(task: Task, input: DelegateInput, branch: string | null): string {
  const header = task.identifier ? `${task.identifier}: ${task.title}` : task.title;
  const setup =
    input.mode === "worktree"
      ? `You are in a new git worktree of ${input.projectName} on branch "${branch}".`
      : branch
        ? `You are in the main checkout of ${input.projectName}. Work on branch "${branch}".`
        : `You are in the main checkout of ${input.projectName}, on its current branch.`;

  return [
    `# Task: ${header}`,
    task.url ? `Link: ${task.url}` : null,
    task.priority ? `Priority: ${task.priority}` : null,
    task.dueDate ? `Due: ${task.dueDate.slice(0, 10)}` : null,
    "",
    "## Description",
    task.description.trim() || "(no description)",
    "",
    "## Work setup",
    setup,
    "",
    statusRules(task),
    input.extraInstructions.trim() ? `\n## Extra instructions\n${input.extraInstructions.trim()}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function delegateTask(input: DelegateInput, paseo: PaseoApi) {
  const task = (await readTasks()).find((candidate) => candidate.id === input.taskId);
  if (!task) throw new Error("Task not found. Refresh the list and try again.");
  if (input.mode === "worktree" && !input.branch) throw new Error("A worktree needs a branch name.");

  const branch = input.branch || null;
  const provider = input.model ? `${input.provider}/${input.model}` : input.provider;
  const title = (task.identifier ? `${task.identifier} ${task.title}` : task.title).slice(0, 80);
  const prompt = buildPrompt(task, input, branch);

  let workspace: PaseoWorkspaceHandle;
  if (input.mode === "worktree") {
    workspace = await paseo.workspaces.create({
      title,
      source: {
        kind: "worktree",
        cwd: input.projectPath,
        projectId: input.projectId,
        action: "branch-off",
        branchName: input.branch,
        ...(input.baseBranch ? { refName: input.baseBranch } : {}),
      },
    });
  } else {
    // Reuse the project's existing local workspace, so the agent joins it instead of a new one.
    workspace = await paseo.workspaces.open(input.projectPath);
  }

  const agent = await workspace.agents.create({
    title,
    config: { provider },
    prompt,
    labels: { "task-viewer.task-id": task.id },
    ...(input.mode === "local" && branch
      ? {
          git: {
            createNewBranch: true,
            newBranchName: branch,
            ...(input.baseBranch ? { baseBranch: input.baseBranch } : {}),
          },
        }
      : {}),
  });

  const assignment: Assignment = {
    agentId: agent.id,
    workspaceId: workspace.id,
    projectName: input.projectName,
    mode: input.mode,
    branch,
    provider,
    createdAt: new Date().toISOString(),
  };

  const updated = await mutateTasks((tasks) => {
    const index = tasks.findIndex((candidate) => candidate.id === task.id);
    if (index === -1) throw new Error("Task was deleted while the agent was starting.");
    const next = { ...tasks[index], assignments: [...tasks[index].assignments, assignment] };
    tasks[index] = next;
    return { tasks, result: next };
  });

  return { agentId: agent.id, workspaceId: workspace.id, task: updated };
}
