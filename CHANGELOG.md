# Changelog

## 0.4.0 - 2026-10-30

- Demo mode: a Show demo data switch in Task viewer settings shows a fictional company (tasks, Linear projects, and project issues, with dates relative to today) instead of your real data. Editing and delegation are off while it is on. The delegate form shows fictional repositories.
- Screenshots in the README and in the plugin manifest, taken with demo data.
- Suggested branch names are cut at a whole word instead of in the middle of a word.
- Project screen: "(you)" follows your name, and the start date uses the same short format as other dates.
- Projects tab: "1 needs attention" and "1 open issue is yours" read correctly for one item.

## 0.3.0 - 2026-10-29

- New Projects tab: active Linear projects you lead, are a member of, or have open issues in. Each card shows status, health, progress, open issues per stage, target date (with overdue and due-soon highlights), lead, your open issues, and unassigned issues. Projects that need attention come first. Projects with no open issues are in a collapsed section.
- New project screen: every issue in the project grouped by stage and sorted by priority and due date, with search and filters (open, done, all; everyone, mine, unassigned), milestones, and a link to Linear. Issues assigned to you open the full task view with delegation.
- Linear tasks show their project name and have an Open project button.
- New Command Center item: Open Linear projects.
- Redesigned header: a sticky toolbar with underline tabs (My tasks, Projects) and counts, sync status and actions on the right, and one filter row with search and segmented filters that show counts. On narrow screens the actions become icon buttons and the filters scroll sideways.

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
