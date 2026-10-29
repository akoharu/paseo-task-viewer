import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { type Task, taskSchema } from "../shared/tasks";

export const dataDir = join(
  process.env.PASEO_HOME ?? join(homedir(), ".paseo"),
  "plugin-data",
  "task-viewer",
);

const tasksFile = join(dataDir, "tasks.json");
const storedTasksSchema = z.object({ version: z.literal(1), tasks: z.array(taskSchema) });

export async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

// Write to a temp file and rename, so a crash never leaves half a file behind.
export async function writeJsonAtomic(path: string, value: unknown, mode = 0o600): Promise<void> {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode });
  await rename(temp, path);
}

let cache: Task[] | null = null;
// Serializes read-modify-write cycles so a sync and a user edit cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Task[]> {
  if (cache) return cache;
  const raw = await readJson(tasksFile);
  if (raw === undefined) {
    cache = [];
    return cache;
  }
  const parsed = storedTasksSchema.safeParse(raw);
  if (!parsed.success) {
    // Keep the bad file for inspection instead of silently losing tasks.
    await rename(tasksFile, `${tasksFile}.invalid-${Date.now()}`);
    console.error("tasks.json was invalid and was moved aside", parsed.error.message);
    cache = [];
    return cache;
  }
  cache = parsed.data.tasks;
  return cache;
}

export async function readTasks(): Promise<Task[]> {
  await queue;
  return [...(await load())];
}

export function mutateTasks<T>(change: (tasks: Task[]) => { tasks: Task[]; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const current = await load();
    const { tasks, result } = change([...current]);
    await writeJsonAtomic(tasksFile, { version: 1, tasks });
    cache = tasks;
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
