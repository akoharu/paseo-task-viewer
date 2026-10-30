import { type PluginSurfaceProps, useRpc, useSettings } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { type Preferences, taskViewerSettings } from "../shared/settings";
import {
  type CredentialProvider,
  credentialStatusRpc,
  saveCredentialRpc,
  SOURCE_LABELS,
  testCredentialRpc,
} from "../shared/tasks";
import { errorMessage } from "./kit";


export function SettingsScreen({ theme }: PluginSurfaceProps) {
  return (
    <View style={{ gap: 24 }}>
      <CredentialSection provider="clickup" theme={theme} />
      <CredentialSection provider="linear" theme={theme} />
      <PreferencesSection />
      <DemoSection />
    </View>
  );
}

const TOKEN_HINTS: Record<CredentialProvider, string> = {
  clickup: "ClickUp → Settings → Apps → API Token (starts with pk_). Or set CLICKUP_API_TOKEN for the daemon.",
  linear: "Linear → Settings → Security & access → Personal API keys. Or set LINEAR_API_KEY for the daemon.",
};

function CredentialSection({ provider, theme }: { provider: CredentialProvider } & Pick<PluginSurfaceProps, "theme">) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const getStatus = useRpc(credentialStatusRpc);
  const save = useRpc(saveCredentialRpc);
  const test = useRpc(testCredentialRpc);
  const status = useQuery({ queryKey: ["credentials"], queryFn: () => getStatus({}) });
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const saveMutation = useMutation({
    mutationFn: (token: string | null) => save({ provider, token }),
    onSuccess: async (_, token) => {
      setDraft("");
      setResult(null);
      await queryClient.invalidateQueries({ queryKey: ["credentials"] });
      toast.show(token ? "Token saved" : "Token removed", { variant: "success" });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const testMutation = useMutation({
    mutationFn: () => test({ provider }),
    onSuccess: setResult,
    onError: (error) => setResult({ ok: false, message: errorMessage(error) }),
  });

  const current = status.data?.[provider];
  const label = SOURCE_LABELS[provider];
  const statusText = !current
    ? "Checking…"
    : !current.configured
      ? "Not connected"
      : current.origin === "env"
        ? "Connected with an environment variable"
        : "Connected with a saved token";

  return (
    <SettingsSection title={label}>
      <SettingsCard>
        <SettingsRow label="Status" hint={statusText} />
        <SettingsInput
          key={`${provider}-${current?.origin ?? "none"}`}
          label="API token"
          hint={TOKEN_HINTS[provider]}
          placeholder={current?.configured ? "Paste a new token to replace it" : "Paste token"}
          secureTextEntry
          onChangeText={setDraft}
        />
        <SettingsAction
          label="Save token"
          hint="Stored in a private file on the daemon machine. It is never sent back to the app."
          actionLabel="Save"
          disabled={!draft.trim() || saveMutation.isPending}
          onPress={() => saveMutation.mutate(draft.trim())}
        />
        <SettingsAction
          label="Test connection"
          actionLabel={testMutation.isPending ? "Testing…" : "Test"}
          disabled={!current?.configured || testMutation.isPending}
          onPress={() => testMutation.mutate()}
        />
        {current?.origin === "saved" ? (
          <SettingsAction
            label="Remove saved token"
            actionLabel="Remove"
            disabled={saveMutation.isPending}
            onPress={() => saveMutation.mutate(null)}
          />
        ) : null}
      </SettingsCard>
      {result ? (
        <Text style={{ color: result.ok ? theme.colors.statusSuccess : theme.colors.statusDanger, marginTop: 8 }}>
          {result.message}
        </Text>
      ) : null}
    </SettingsSection>
  );
}

const INTERVAL_OPTIONS = [
  { label: "Off (manual only)", value: "0" },
  { label: "Every 5 minutes", value: "5" },
  { label: "Every 15 minutes", value: "15" },
  { label: "Every 30 minutes", value: "30" },
  { label: "Every hour", value: "60" },
] as const;

function PreferencesSection() {
  const settings = useSettings(taskViewerSettings);
  const toast = useToast();
  // Draft keeps the revision it was loaded from, so a stale save is rejected instead of overwriting.
  const [draft, setDraft] = useState<{ values: Preferences; revision: string } | null>(null);

  if (settings.status === "loading") return <SettingsSection title="Sync and agents"><SettingsCard><SettingsRow label="Loading…" /></SettingsCard></SettingsSection>;
  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Sync and agents">
        <SettingsCard>
          <SettingsRow label="Settings could not be read" error={settings.status === "invalid" || settings.status === "error" ? String(settings.error) : null} />
          <SettingsAction label="Reset to defaults" actionLabel="Reset" onPress={() => void settings.reset()} />
        </SettingsCard>
      </SettingsSection>
    );
  }

  const values = draft?.values ?? settings.values;
  const edit = (patch: Partial<Preferences>) =>
    setDraft({ values: { ...values, ...patch }, revision: draft?.revision ?? settings.revision });
  const intervalValue = INTERVAL_OPTIONS.some((option) => option.value === String(values.syncIntervalMinutes))
    ? String(values.syncIntervalMinutes)
    : "15";

  async function saveDraft() {
    if (!draft) return;
    const ok = await settings.save(draft.values, draft.revision);
    if (ok) {
      setDraft(null);
      toast.show("Preferences saved", { variant: "success" });
    } else {
      toast.error(settings.saveError ? String(settings.saveError) : "Could not save. Reload and try again.");
    }
  }

  return (
    <SettingsSection title="Sync and agents">
      <SettingsCard>
        <SettingsSelect
          label="Automatic sync"
          hint="Pulls tickets assigned to you. You can always press Sync now."
          value={intervalValue}
          options={INTERVAL_OPTIONS}
          onValueChange={(value) => edit({ syncIntervalMinutes: Number(value) })}
        />
        <SettingsSwitch label="Sync ClickUp" value={values.clickupEnabled} onValueChange={(clickupEnabled) => edit({ clickupEnabled })} />
        <SettingsInput
          label="ClickUp workspace IDs"
          hint="Comma-separated. Empty means all workspaces."
          initialValue={values.clickupTeamIds}
          onChangeText={(clickupTeamIds) => edit({ clickupTeamIds })}
        />
        <SettingsInput
          label="ClickUp list IDs"
          hint="Comma-separated. Empty means all lists."
          initialValue={values.clickupListIds}
          onChangeText={(clickupListIds) => edit({ clickupListIds })}
        />
        <SettingsSwitch label="Sync Linear" value={values.linearEnabled} onValueChange={(linearEnabled) => edit({ linearEnabled })} />
        <SettingsInput
          label="Linear team keys"
          hint="Comma-separated, for example ENG. Empty means all teams."
          initialValue={values.linearTeamKeys}
          onChangeText={(linearTeamKeys) => edit({ linearTeamKeys })}
        />
        <SettingsSelect
          label="Default place for agents"
          value={values.defaultMode}
          options={[
            { label: "New worktree", value: "worktree" },
            { label: "Local checkout", value: "local" },
          ]}
          onValueChange={(defaultMode) => edit({ defaultMode })}
        />
        <SettingsInput
          label="Default agent provider"
          hint="Provider ID, for example claude or codex."
          initialValue={values.defaultProvider}
          onChangeText={(defaultProvider) => edit({ defaultProvider: defaultProvider.trim() })}
        />
        <SettingsInput
          label="Default model"
          hint="Model ID, for example claude-opus-5-5. Empty uses the provider default."
          initialValue={values.defaultModel}
          onChangeText={(defaultModel) => edit({ defaultModel: defaultModel.trim() })}
        />
        <SettingsInput
          label="Default extra instructions"
          hint="Pre-filled in every delegation. You can edit it per task."
          initialValue={values.agentInstructions}
          onChangeText={(agentInstructions) => edit({ agentInstructions })}
        />
        <SettingsAction
          label={draft ? "You have unsaved changes" : "All changes saved"}
          actionLabel={settings.saving ? "Saving…" : "Save"}
          disabled={!draft || settings.saving}
          onPress={() => void saveDraft()}
        />
      </SettingsCard>
    </SettingsSection>
  );
}

function DemoSection() {
  const settings = useSettings(taskViewerSettings);
  const toast = useToast();
  if (settings.status !== "ready") return null;
  return (
    <SettingsSection title="Demo">
      <SettingsCard>
        <SettingsSwitch
          label="Show demo data"
          hint="Shows a fictional company instead of your real tasks and projects, for screenshots or to try the plugin. Editing and delegation are off while it is on. Your real data is not changed."
          value={settings.values.demoMode}
          disabled={settings.saving}
          onValueChange={async (demoMode) => {
            const ok = await settings.save({ ...settings.values, demoMode }, settings.revision);
            if (!ok) toast.error("Could not save. Reload and try again.");
          }}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
