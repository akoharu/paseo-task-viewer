# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The plugin is React Native code that the Paseo app renders. It runs in the Paseo desktop app, in the browser, and in the Paseo phone apps. It follows Paseo's own design language on every device and does not change its design per operating system.

## Users

Primary user: the author, a software developer at a small product company. Their work arrives as ClickUp tasks, Linear issues, and requests in Slack threads. They run coding agents in Paseo many times a day and want to stay inside Paseo instead of switching between apps.

Secondary users: other Paseo users who track work in ClickUp or Linear and install the plugin from the community registry. The author's workflow decides; changes must still work for other teams.

## Product Purpose

Task viewer is a Paseo plugin that puts all of the user's work in one place and connects it to coding agents. It has four jobs, all confirmed as important:

1. Know what to do next: see the right ticket to work on now, stay on time, and notice old tickets before they are forgotten.
2. Delegate to agents: hand a ticket to a coding agent quickly, with the right project, branch, model, thinking level, and mode.
3. Monitor projects: check Linear project progress, risks, deadlines, and who works on what.
4. Capture quick requests: add manual tasks, for example from a Slack thread, so nothing gets lost.

Success means the user can plan, start, and follow their work from Paseo for a whole day, nothing assigned to them is forgotten or late without them knowing, and ticket status stays correct without manual updates.

## Positioning

Task viewer lives inside Paseo, where the agents run. Delegating a ticket starts an agent in the right workspace (a new worktree or the local checkout) with the ticket details and rules to keep the ticket status up to date. The agent updates ClickUp or Linear through its own MCP tools or API access. The plugin itself only reads tickets, so ClickUp and Linear stay the source of truth, and the next sync shows what the agent changed.

## Operating Context

- Used every day in the Paseo desktop app on macOS, and on the phone to check status and act on the go. Desktop and phone must both work well.
- Work comes from ClickUp (lists such as engineering, customer, and sales lists), Linear (teams, cycles, projects, and milestones), and Slack threads (captured as manual tasks).
- The user's code lives in several Paseo projects. Agents are usually Claude or Codex, started with a chosen model, thinking level, and mode such as Plan mode or Bypass.
- The daemon syncs tickets assigned to the user every 15 minutes by default, or on demand.

## Capabilities and Constraints

Capabilities today (version 0.6.0):

- My tasks: ClickUp tasks and Linear issues assigned to the user, plus manual tasks. Orders: Up next (ranked by deadline, priority, work already started, and current cycle, with the reason shown), By status, and Oldest. Filters by state and source, and search.
- Each ticket shows priority, due date, Linear cycle, project, created date, and a Stale badge for old open tickets with no recent update.
- Projects: active Linear projects the user leads, is a member of, or has issues in, with status, health, progress, target date, and every issue in the project.
- Delegation from any ticket assigned to the user, with remembered choices.
- Demo mode with a fictional company, for screenshots and for trying the plugin without accounts.

Constraints:

- Paseo plugin rules: React Native primitives only, no DOM or HTML elements, colors from the host theme tokens so every Paseo theme works, and `layout.compact` for phones. Paseo 0.12.0 or later.
- ClickUp has no project object, so the Projects view covers Linear only.
- Only tickets assigned to the user appear in My tasks. Tickets reassigned to someone else are removed at the next sync, unless an agent the user started still works on them.
- The plugin never writes to ClickUp or Linear. API tokens stay on the daemon machine and never reach the app.

## Brand Commitments

- Name: Task viewer. Icon: `assets/icon.png` (white checklist on indigo).
- The interface must feel like part of Paseo: host theme colors, Lucide icons, and the same mode icons Paseo uses.
- All text is plain English for readers who use English as a second language: short sentences, common words, no idioms.
- The registry listing (`OVERVIEW.md`) uses sentence case and plain factual language, with no em dashes and no marketing claims.

## Evidence on Hand

- README, OVERVIEW, and CHANGELOG in the repository.
- Screenshots taken with demo data in `assets/screenshots/`.
- Demo data for a fictional company ("Acme") in `server/demo.ts`.
- Not available yet: a registry listing, install numbers, other users, or testimonials. Do not invent them.

## Product Principles

1. ClickUp and Linear stay the source of truth. The plugin shows, ranks, and delegates; it never changes tickets on its own.
2. Next action first. The default view answers "what should I work on now, and why", and old or forgotten work stays visible.
3. Mine means mine. My tasks shows only tickets assigned to the user; other people's work belongs in the project view.
4. Native to Paseo on desktop and phone. Use the host's look, controls, and patterns instead of inventing new ones.
5. Safe by default. Tokens stay on the daemon, demos and screenshots show no private data, and anything that starts agents or changes git happens only after a clear user action.

## Accessibility & Inclusion

- Plain English for ESL readers in all labels, hints, and messages.
- Text color always comes from the host theme, so the plugin stays readable in light and dark themes.
- Every pressable control has an accessibility label, and layouts work on narrow phone screens.
