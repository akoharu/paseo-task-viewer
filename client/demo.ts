import { useSettings } from "@getpaseo/plugin/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { taskViewerSettings } from "../shared/settings";

// True when demo data is on. Cached tasks and projects are reloaded when it changes.
export function useDemoMode(): boolean {
  const settings = useSettings(taskViewerSettings);
  const demo = settings.status === "ready" && settings.values.demoMode;
  const queryClient = useQueryClient();
  const previous = useRef(demo);
  useEffect(() => {
    if (previous.current === demo) return;
    previous.current = demo;
    void queryClient.invalidateQueries();
  }, [demo, queryClient]);
  return demo;
}
