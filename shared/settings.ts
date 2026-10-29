import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

// Non-secret preferences. API tokens are stored separately on the daemon and never sent to clients.
const preferencesSchema = z.object({
  clickupEnabled: z.boolean().default(true),
  // Comma-separated ClickUp workspace (team) IDs. Empty means every workspace the token can see.
  clickupTeamIds: z.string().default(""),
  // Comma-separated ClickUp list IDs. Empty means every list.
  clickupListIds: z.string().default(""),
  linearEnabled: z.boolean().default(true),
  // Comma-separated Linear team keys such as "ENG". Empty means every team.
  linearTeamKeys: z.string().default(""),
  // 0 turns the automatic sync off.
  syncIntervalMinutes: z.number().int().min(0).max(1440).default(15),
  defaultProvider: z.string().default("claude"),
  defaultModel: z.string().default(""),
  defaultMode: z.enum(["local", "worktree"]).default("worktree"),
  // Pre-filled as extra instructions in every delegation form.
  agentInstructions: z.string().default(""),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const taskViewerSettings = defineSettings({
  id: "preferences",
  scope: "host",
  version: 1,
  schema: preferencesSchema,
});

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
