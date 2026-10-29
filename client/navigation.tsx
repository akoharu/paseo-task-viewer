import type { PluginOpenScreenInput } from "@getpaseo/plugin/client";
import { createContext, useContext } from "react";

// Screen props in Paseo 0.12 have no openScreen, so the client entry passes it down through context.
export const OpenScreenContext = createContext<((input: PluginOpenScreenInput) => void) | null>(null);

export function useOpenScreen() {
  return useContext(OpenScreenContext);
}

export function openProjectInput(project: { id: string; name: string }): PluginOpenScreenInput {
  return { screenId: "project", params: { projectId: project.id, name: project.name } };
}
