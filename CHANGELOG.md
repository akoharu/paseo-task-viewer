# Changelog

## 0.2.0 - 2026-10-29

- Show the priority of each task (urgent, high, normal or medium, low) as a colored badge.
- Show the due date on each task, with highlights for overdue, due today, and due tomorrow.
- Show the Linear cycle of each issue and whether it is the current, a past, or an upcoming cycle.
- Add the cycle to the agent prompt.
- Tasks saved by 0.1.0 load without changes and get the new fields on the next sync.

## 0.1.0 - 2026-10-29

First release.

- Tasks screen with ClickUp tasks, Linear issues, and manual tasks, with source and state filters and search.
- Scheduled and manual sync of open tickets assigned to you. Status always comes from ClickUp or Linear.
- Delegate a task to an agent in a new git worktree or in the local checkout, with a suggested branch name.
- Agent prompt with the ticket details, the allowed status names, and rules for updating the ticket status.
- Settings screen for API tokens (stored only on the daemon) and sync and agent defaults.
- Command Center items: Open tasks, Sync tasks, Task viewer settings.
