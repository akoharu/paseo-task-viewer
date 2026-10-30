import type { PluginServerContext } from "@getpaseo/plugin/server";
import { getToken, saveToken } from "./server/credentials";
import { demoProject, demoProjectList, demoTasks } from "./server/demo";
import { testClickUp } from "./server/clickup";
import { delegateTask } from "./server/delegate";
import { testLinear } from "./server/linear";
import { getProject, listProjects } from "./server/linear-projects";
import { createManualTask, deleteTask, updateManualTask } from "./server/manual";
import { readTasks } from "./server/store";
import { getSyncState, syncNow } from "./server/sync";
import { getProjectRpc, listProjectsRpc } from "./shared/projects";
import { type Preferences, preferencesSchema, taskViewerSettings } from "./shared/settings";
import {
  createTaskRpc,
  credentialStatusRpc,
  delegateTaskRpc,
  deleteTaskRpc,
  listTasksRpc,
  saveCredentialRpc,
  syncTasksRpc,
  testCredentialRpc,
  updateTaskRpc,
} from "./shared/tasks";

const DEMO_READ_ONLY = "Demo data is on, so editing and delegation are off. Turn it off in Task viewer settings.";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(taskViewerSettings);
  let preferences: Preferences = preferencesSchema.parse({});
  let timer: ReturnType<typeof setInterval> | null = null;
  let firstSync: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const runSync = () =>
    syncNow(preferences).catch((error) => console.error("Sync failed", String(error)));

  const schedule = () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (stopped || preferences.syncIntervalMinutes <= 0) return;
    timer = setInterval(runSync, preferences.syncIntervalMinutes * 60_000);
  };

  const apply = (state: Awaited<ReturnType<typeof settings.read>>) => {
    if (state.status !== "ready") return;
    preferences = state.values;
    schedule();
  };

  const unsubscribe = settings.subscribe(apply);
  void settings.read().then((state) => {
    apply(state);
    // Sync shortly after start, so the list is fresh without blocking plugin startup.
    if (!stopped && preferences.syncIntervalMinutes > 0) firstSync = setTimeout(runSync, 5_000);
  });

  const listResult = async () =>
    preferences.demoMode
      ? { tasks: demoTasks(), sync: { running: false, lastRunAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), errors: [] } }
      : { tasks: await readTasks(), sync: getSyncState() };
  // Demo data never reaches the real task store, and no agent starts from a fictional ticket.
  const notInDemo = () => {
    if (preferences.demoMode) throw new Error(DEMO_READ_ONLY);
  };

  server.handle(listTasksRpc, listResult);
  server.handle(syncTasksRpc, async () => {
    if (!preferences.demoMode) await syncNow(preferences);
    return listResult();
  });
  server.handle(createTaskRpc, (input) => (notInDemo(), createManualTask(input)));
  server.handle(updateTaskRpc, (input) => (notInDemo(), updateManualTask(input)));
  server.handle(deleteTaskRpc, (input) => (notInDemo(), deleteTask(input)));
  server.handle(delegateTaskRpc, (input, { paseo }) => (notInDemo(), delegateTask(input, paseo)));

  server.handle(listProjectsRpc, ({ force }) => (preferences.demoMode ? demoProjectList() : listProjects(force)));
  server.handle(getProjectRpc, ({ projectId, force }) =>
    preferences.demoMode ? demoProject(projectId) : getProject(projectId, force),
  );

  server.handle(credentialStatusRpc, async () => {
    const [clickup, linear] = await Promise.all([getToken("clickup"), getToken("linear")]);
    return {
      clickup: { configured: Boolean(clickup), origin: clickup?.origin ?? null },
      linear: { configured: Boolean(linear), origin: linear?.origin ?? null },
    };
  });
  server.handle(saveCredentialRpc, async ({ provider, token }) => {
    await saveToken(provider, token || null);
    return { saved: true };
  });
  server.handle(testCredentialRpc, async ({ provider }) => {
    const credential = await getToken(provider);
    if (!credential) return { ok: false, message: "No token is set." };
    try {
      const message =
        provider === "clickup" ? await testClickUp(credential.token) : await testLinear(credential.token);
      return { ok: true, message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });

  return () => {
    stopped = true;
    unsubscribe();
    if (timer) clearInterval(timer);
    if (firstSync) clearTimeout(firstSync);
  };
}
