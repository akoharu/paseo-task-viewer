Task viewer shows your ClickUp tasks, Linear issues, and your own manual tasks on one screen in Paseo. From any task you can start a coding agent in one of your projects, in a new git worktree or in the project's local checkout. You can follow your work without switching between apps.

## How it works

The Paseo daemon pulls the open tickets that are assigned to you from ClickUp and Linear. It syncs on a schedule (every 15 minutes by default) and when you press Sync now. The status of a synced ticket always comes from ClickUp or Linear. Task viewer never changes tickets itself. Each task shows its priority and due date, and overdue or soon-due tasks are highlighted. Linear issues also show their cycle and whether it is the current, a past, or an upcoming cycle.

The Projects tab lists the active Linear projects you lead, are a member of, or have open issues in. Each project shows its status, health, progress, open issues per stage, target date, lead, and how many open issues are yours. Projects that are overdue, at risk, or off track come first. Opening a project shows every issue in it, grouped by stage, with priority, due date, cycle, and assignee. Issues assigned to you open the full task view, so you can delegate them from there. ClickUp has no project object, so this tab covers Linear only.

When you delegate a task, you choose a project, a new worktree or the local checkout, a branch name, and an agent provider and model. The agent's first prompt contains the ticket details, the status names that ticket can use, and rules to keep the status up to date: move it to in progress when work starts, move it to review when a PR is open, add a closing comment, and never mark it done without your approval. The agent updates the ticket through the ClickUp or Linear MCP tools or API access that its provider has. The next sync shows the new status.

## Setup

Open Settings, then Plugins, then Task viewer. Paste a ClickUp personal API token (it starts with pk_) and a Linear personal API key, then use Test to check each one. You can also set CLICKUP_API_TOKEN and LINEAR_API_KEY in the environment of the Paseo daemon. You can connect one service, both, or none. Manual tasks work without any account.

If you want agents to update ticket status, give the agent provider access to ClickUp or Linear, for example with an MCP server. Without that access, the agent still does the coding work and reports that it could not update the ticket.

Requires Paseo 0.12.0 or later. Tested on a macOS daemon with the Paseo desktop app. The interface uses only React Native components, so it is built to run in the web and mobile apps too.

## Data and permissions

- Your API tokens are stored in a private file (permission 0600) in the plugin data folder under the Paseo home on the daemon machine. They are only sent to api.clickup.com and api.linear.app. They are never sent to the Paseo app or written to logs.
- Synced tickets are stored as JSON in the same folder. Linear project data is read live when you open the Projects tab and kept in memory for one minute.
- Task viewer reads tickets only. It sends no write requests to ClickUp or Linear.
- When you delegate a task, its title, description, link, and status list go into the agent prompt. That prompt goes to the agent provider you choose, for example Anthropic or OpenAI.
- Delegation creates Paseo workspaces and agents. Worktree mode creates a git worktree and a new branch. Local mode can create a branch in your main checkout.

## Limits

- Only tickets assigned to you are synced, up to 500 per service.
- Finished tickets without an agent are removed 14 days after their last update.
- Synced tickets are read-only in Paseo. Manual tasks can be edited and deleted.
- ClickUp and Linear workflows are mapped to five groups (to do, in progress, in review, done, canceled) by status type and name. Unusual status names can land in the wrong group.
