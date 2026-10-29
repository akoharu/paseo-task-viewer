# Task viewer for Paseo

A [Paseo](https://paseo.sh) plugin that shows your ClickUp tasks, Linear issues, and manual tasks on one screen, and lets you hand any of them to a coding agent.

<p align="center"><img src="assets/icon.png" width="96" alt="Task viewer icon"></p>

## Features

- **One list for all your work.** ClickUp tasks and Linear issues assigned to you, plus manual tasks (for example a request from a Slack thread). Filter by source and state, and search.
- **Priority, deadline, and cycle at a glance.** Each task shows its priority, its due date (with "Overdue", "Due today", and "Due tomorrow" highlights), and for Linear issues the cycle and whether it is the current one.
- **Linear project monitoring.** A Projects tab lists the active Linear projects you lead, are a member of, or have issues in. Each card shows status, health, progress, open issues per stage, target date, lead, and how many open issues are yours. Projects that need attention (overdue, at risk, off track) come first. Open a project to see every issue in it, grouped by stage, with filters for open or done work and for your, unassigned, or everyone's issues.
- **Real status.** The status of a synced ticket always comes from ClickUp or Linear. Sync runs on a schedule (every 15 minutes by default) or when you press **Sync now**.
- **Delegate to an agent.** Pick a project, choose **New worktree** or **Local checkout**, set a branch name (suggested from the ticket), and choose the agent provider and model.
- **Status-aware agents.** The agent's prompt contains the ticket details, the exact status names the ticket can use, and rules for keeping the status up to date through the agent's ClickUp or Linear MCP tools or API.
- **Agent links.** Each task lists the agents that work on it, with a button to open them.
- Built with React Native components only, so the UI is made for the Paseo desktop, web, and mobile apps. Tested on macOS with the desktop app.

## Requirements

- Paseo 0.12.0 or later, with plugins turned on (**Settings → Plugins → Enable plugins**).
- Optional: a ClickUp personal API token and/or a Linear personal API key.
- Optional: ClickUp or Linear access for your agent provider (for example an MCP server), so agents can update ticket status.

## Install

```bash
paseo plugin add git:akoharu/paseo-task-viewer
```

Or paste `git:akoharu/paseo-task-viewer` into **Settings → Plugins → Plugin source** and select **Install plugin**.

Paseo plugins are trusted, unsandboxed code. Please read the source before you install it.

## Setup

1. Open **Settings → Plugins → Task viewer**, or press **⌘K** / **Ctrl+K** and choose **Task viewer settings**.
2. Paste your tokens and select **Save**, then **Test**:
   - ClickUp: **Settings → Apps → API Token** (starts with `pk_`).
   - Linear: **Settings → Security & access → Personal API keys**.

   Instead, you can set `CLICKUP_API_TOKEN` and `LINEAR_API_KEY` in the daemon environment. A saved token takes priority over an environment variable.
3. Open **Tasks** in the sidebar. Switch between **My tasks** and **Projects** at the top.
4. Optional: limit the sync to some ClickUp workspaces or lists, or to some Linear team keys, and set your default agent provider, model, and delegation mode.

## How delegation works

| Mode           | What happens                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| New worktree   | Creates a new Paseo workspace with a git worktree on a new branch (from the default branch or the base branch you enter). Your main checkout is not touched. |
| Local checkout | Adds the agent to the project's existing workspace. If you enter a branch name, the agent starts on that new branch. Otherwise it stays on the current branch. |

The agent is labeled `task-viewer.task-id=<task id>`. The prompt tells it to:

1. Move the ticket to an in-progress status when work starts.
2. Move it to a review status (for example "In Review" or "Merge Request") when a PR is open.
3. Never move it to done, closed, or canceled unless you say so.
4. Add a short comment with what changed and the branch or PR link.
5. Use only the listed status names.
6. Report clearly if it could not reach ClickUp or Linear.

Task viewer itself never writes to ClickUp or Linear.

## Data and privacy

- Tokens are stored in `$PASEO_HOME/plugin-data/task-viewer/secrets.json` (default `~/.paseo`) with file permission `0600`. They are only sent to `api.clickup.com` and `api.linear.app`, never to the app, and never logged.
- Tasks are stored in `$PASEO_HOME/plugin-data/task-viewer/tasks.json`.
- Linear project data is read live when you open the Projects tab or a project, and kept in memory for one minute. It is not saved to disk.
- Preferences (no secrets) are stored in Paseo's plugin settings for the host.
- When you delegate a task, its details go into the agent prompt, which is sent to the agent provider you choose.

## Development

```bash
git clone https://github.com/akoharu/paseo-task-viewer.git
cd paseo-task-viewer
npm install
npm run typecheck
paseo plugin install "$(pwd)"
```

After you change the code, run `npm run typecheck` and then `paseo plugin reload task-viewer`. Use `paseo plugin logs task-viewer` to read daemon-side output.

Project layout, following the [Paseo plugin guide](https://paseo.sh/docs/plugins):

```text
index.client.tsx   Tasks screen, sidebar item, settings screen, Command Center items
index.server.ts    RPC handlers and the sync timer (daemon subprocess)
client/            React Native UI
server/            ClickUp and Linear clients, sync, storage, delegation
shared/            Zod RPC contracts and the settings schema
```

The plugin uses only host-provided libraries at runtime, so it needs no build step.

## Troubleshooting

- **No Tasks item in the sidebar:** check that plugins are enabled, that `paseo plugin ls` shows `task-viewer` as `running`, and that the item is not hidden in **Settings → Sidebar**.
- **Sync errors:** the error shows at the top of the Tasks screen. Use **Test** in the settings to check the token. More detail: `paseo plugin logs task-viewer`.
- **Ticket shows "not in your queue":** it was unassigned from you, filtered out by your settings, or deleted.

## License

[MIT](LICENSE)
