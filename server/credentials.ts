import { join } from "node:path";
import { z } from "zod";
import type { CredentialProvider } from "../shared/tasks";
import { dataDir, readJson, writeJsonAtomic } from "./store";

// Tokens live in a 0600 file on the daemon machine. They never go to the app or to plugin logs.
const secretsFile = join(dataDir, "secrets.json");
const secretsSchema = z.object({
  clickup: z.string().optional(),
  linear: z.string().optional(),
});

const ENV_NAMES: Record<CredentialProvider, string> = {
  clickup: "CLICKUP_API_TOKEN",
  linear: "LINEAR_API_KEY",
};

async function readSecrets(): Promise<z.infer<typeof secretsSchema>> {
  const parsed = secretsSchema.safeParse((await readJson(secretsFile)) ?? {});
  return parsed.success ? parsed.data : {};
}

export async function getToken(
  provider: CredentialProvider,
): Promise<{ token: string; origin: "env" | "saved" } | null> {
  const saved = (await readSecrets())[provider];
  if (saved) return { token: saved, origin: "saved" };
  const env = process.env[ENV_NAMES[provider]];
  if (env) return { token: env, origin: "env" };
  return null;
}

export async function saveToken(provider: CredentialProvider, token: string | null): Promise<void> {
  const secrets = await readSecrets();
  if (token) secrets[provider] = token;
  else delete secrets[provider];
  await writeJsonAtomic(secretsFile, secrets, 0o600);
}
