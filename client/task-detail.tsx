import { openExternalUrl, type PluginSurfaceProps, usePaseo, useRpc, useSettings } from "@getpaseo/plugin/client";
import { Icon, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DEMO_REPOSITORIES, taskViewerSettings } from "../shared/settings";
import {
  type DelegationMode,
  delegateTaskRpc,
  deleteTaskRpc,
  SOURCE_LABELS,
  STATUS_GROUP_LABELS,
  type StatusGroup,
  suggestBranchName,
  type Task,
  type TaskListOutput,
  updateTaskRpc,
} from "../shared/tasks";
import { useDemoMode } from "./demo";
import { openProjectInput, useOpenScreen } from "./navigation";
import { ageLabel, daysSince, rankableTask } from "../shared/ranking";
import {
  Badge,
  Button,
  Chip,
  ChipRow,
  errorMessage,
  Label,
  relativeTime,
  shortDate,
  staleBadge,
  statusColor,
  statusTextColor,
  TaskBadges,
  type Theme,
} from "./kit";

type Props = Pick<PluginSurfaceProps, "theme" | "layout" | "navigation"> & {
  task: Task;
  onClose(): void;
};

function replaceTask(previous: TaskListOutput | undefined, task: Task): TaskListOutput | undefined {
  if (!previous) return previous;
  return { ...previous, tasks: previous.tasks.map((item) => (item.id === task.id ? task : item)) };
}

export function TaskDetail({ theme, layout, navigation, task, onClose }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const updateTask = useRpc(updateTaskRpc);
  const deleteTask = useRpc(deleteTaskRpc);
  const openScreen = useOpenScreen();
  const created = rankableTask(task).created;
  const [fullDescription, setFullDescription] = useState(false);
  // Long enough that 8 lines can cut it, also on a narrow phone where lines wrap.
  const longDescription = task.description.trim().length > 320 || task.description.split("\n").length > 8;
  const stale = staleBadge(theme, rankableTask(task));

  const statusMutation = useMutation({
    mutationFn: (statusGroup: StatusGroup) => updateTask({ id: task.id, statusGroup }),
    onSuccess: ({ task: next }) => queryClient.setQueryData<TaskListOutput>(["tasks"], (old) => replaceTask(old, next)),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteTask({ id: task.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const text = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={muted}>
          {[SOURCE_LABELS[task.source], task.identifier, task.project?.name ?? task.container].filter(Boolean).join(" · ")}
        </Text>
        <Text selectable style={{ ...text, fontSize: layout.compact ? 18 : 20, fontWeight: "600" }}>
          {task.title}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: task.statusColor ?? statusColor(theme, task.statusGroup) }} />
          <Text style={{ color: statusTextColor(theme, task.statusGroup), fontWeight: "600" }}>{task.status}</Text>
          {task.syncedAt ? <Text style={muted}>Synced {relativeTime(task.syncedAt)}</Text> : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {created ? (
            <Text style={muted}>
              Created {shortDate(new Date(created))} ({ageLabel(daysSince(created) ?? 0)} ago)
            </Text>
          ) : null}
          <Text style={muted}>Updated {relativeTime(task.updatedAt)}</Text>
          {stale ? <Badge {...stale} /> : null}
        </View>
        <TaskBadges theme={theme} task={task} />
        {task.missing ? (
          <Text style={{ color: theme.colors.statusWarning, fontSize: 12 }}>
            This ticket is no longer assigned to you (reassigned, filtered out, or deleted). It stays here only because an agent works on it.
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {task.url ? (
            <Button
              theme={theme}
              variant="secondary"
              label={task.source === "manual" ? "Open link" : `Open in ${SOURCE_LABELS[task.source]}`}
              onPress={() => void openExternalUrl(task.url as string).catch((error) => toast.error(errorMessage(error)))}
            />
          ) : null}
          {task.project && openScreen ? (
            <Button
              theme={theme}
              variant="secondary"
              label="Open project"
              onPress={() => {
                openScreen(openProjectInput(task.project as { id: string; name: string }));
                onClose();
              }}
            />
          ) : null}
          {task.source === "manual" ? (
            <Button
              theme={theme}
              variant="danger"
              label="Delete task"
              busy={deleteMutation.isPending}
              onPress={() => deleteMutation.mutate()}
            />
          ) : null}
        </View>
      </View>

      {task.source === "manual" ? (
        <View style={{ gap: 8 }}>
          <Label theme={theme}>Status</Label>
          <ChipRow>
            {(["todo", "in_progress", "review", "done"] as const).map((group) => (
              <Chip
                key={group}
                theme={theme}
                label={STATUS_GROUP_LABELS[group]}
                selected={task.statusGroup === group}
                onPress={() => statusMutation.mutate(group)}
              />
            ))}
          </ChipRow>
        </View>
      ) : (
        <Text style={muted}>
          Status comes from {SOURCE_LABELS[task.source]}. The assigned agent updates it there, and the next sync shows it here.
        </Text>
      )}

      <View style={{ gap: 8 }}>
        <Label theme={theme}>Description</Label>
        <Text selectable numberOfLines={fullDescription ? undefined : 8} style={{ ...text, lineHeight: 20 }}>
          {task.description.trim() || "No description."}
        </Text>
        {longDescription ? (
          <Pressable accessibilityRole="button" onPress={() => setFullDescription((value) => !value)} hitSlop={6}>
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" }}>
              {fullDescription ? "Show less" : "Show more"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {task.assignments.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Label theme={theme}>Agents</Label>
          {task.assignments.map((assignment) => (
            <View
              key={assignment.agentId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: 10,
                borderRadius: 8,
                backgroundColor: theme.colors.surface1,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text}>
                  {assignment.projectName} · {assignment.mode === "worktree" ? "Worktree" : "Local"}
                </Text>
                <Text style={muted}>
                  {[assignment.branch, assignment.provider, assignment.thinkingLabel, assignment.modeLabel, relativeTime(assignment.createdAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              {navigation ? (
                <Button
                  theme={theme}
                  variant="secondary"
                  label="Open agent"
                  onPress={() => {
                    navigation.openAgent({ agentId: assignment.agentId });
                    onClose();
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <DelegateForm theme={theme} task={task} onStarted={(agentId) => {
        if (navigation) {
          navigation.openAgent({ agentId });
          onClose();
        }
      }} />
    </View>
  );
}

function DelegateForm({ theme, task, onStarted }: { theme: Theme; task: Task; onStarted(agentId: string): void }) {
  const paseo = usePaseo();
  const queryClient = useQueryClient();
  const toast = useToast();
  const settings = useSettings(taskViewerSettings);
  const delegate = useRpc(delegateTaskRpc);

  const demo = useDemoMode();
  const realProjects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await paseo.projects.list()).projects.filter((project) => project.projectKind === "git"),
    enabled: !demo,
  });
  // In demo mode, show fictional repositories so screenshots do not reveal real project names.
  const projects = demo
    ? {
        isPending: false,
        error: null,
        data: DEMO_REPOSITORIES.map((name) => ({
          projectId: `demo-${name}`,
          projectDisplayName: name,
          projectCustomName: null as string | null,
          projectRootPath: `/demo/${name}`,
        })),
      }
    : realProjects;
  const providers = useQuery({ queryKey: ["providers"], queryFn: async () => readProviders(await paseo.providers.snapshot()) });

  const [projectPick, setProjectPick] = useState<string | null>(null);
  const [mode, setMode] = useState<DelegationMode>("worktree");
  const [branch, setBranch] = useState(() => suggestBranchName(task));
  const [baseBranch, setBaseBranch] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  // Explicit picks. Null means "use the last-used value if this provider supports it, else the default".
  const [permissionPick, setPermissionPick] = useState<string | null>(null);
  const [thinkingPick, setThinkingPick] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [editing, setEditing] = useState(false);
  const [allModels, setAllModels] = useState(false);

  // Seed the form from saved defaults once they load.
  useEffect(() => {
    if (initialized || settings.status !== "ready") return;
    setMode(settings.values.defaultMode);
    setProvider(settings.values.defaultProvider);
    setModel(settings.values.defaultModel);
    setExtra(settings.values.agentInstructions);
    setInitialized(true);
  }, [initialized, settings]);

  const remembered = settings.status === "ready" ? settings.values : null;
  // The project you picked, else the one you used last time.
  const projectId = projectPick ?? remembered?.defaultProjectId ?? null;
  const project = projects.data?.find((entry) => entry.projectId === projectId);
  const projectName = project ? project.projectCustomName || project.projectDisplayName : null;

  const selectedProvider = providers.data?.find((entry) => entry.id === provider);
  // "Default model" uses the provider's default model, so its thinking levels apply.
  const selectedModel = selectedProvider?.models.find((entry) => (model ? entry.id === model : entry.isDefault)) ?? selectedProvider?.models[0];
  // A short list first: the default, the current pick, and a few more. The rest is one tap away.
  const visibleModels = useMemo(() => {
    const list = selectedProvider?.models ?? [];
    if (allModels) return list;
    const short = list.slice(0, 4);
    const picked = list.find((entry) => entry.id === model);
    return picked && !short.includes(picked) ? [...short, picked] : short;
  }, [selectedProvider, allModels, model]);
  const hiddenModelCount = (selectedProvider?.models.length ?? 0) - visibleModels.length;

  const permission = pickValid(selectedProvider?.modes ?? [], permissionPick, remembered?.defaultPermissionModeId, selectedProvider?.defaultModeId);
  const thinking = pickValid(selectedModel?.thinking ?? [], thinkingPick, remembered?.defaultThinkingOptionId, selectedModel?.defaultThinkingId);
  const permissionMode = selectedProvider?.modes.find((entry) => entry.id === permission);
  const thinkingOption = selectedModel?.thinking.find((entry) => entry.id === thinking);
  const risky = isRiskyMode(permissionMode);

  // Open the full options once when there is no remembered project to start with.
  const [checkedStart, setCheckedStart] = useState(false);
  useEffect(() => {
    if (checkedStart || settings.status !== "ready" || !projects.data) return;
    if (!project) setEditing(true);
    setCheckedStart(true);
  }, [checkedStart, settings.status, projects.data, project]);

  const blocker = !project
    ? "Choose a project first."
    : !provider
      ? "Choose an agent first."
      : mode === "worktree" && !branch.trim()
        ? "Add a branch name for the new worktree."
        : null;

  const mutation = useMutation({
    mutationFn: () => {
      if (!project) throw new Error("Choose a project first.");
      return delegate({
        taskId: task.id,
        projectId: project.projectId,
        projectName: projectName ?? project.projectDisplayName,
        projectPath: project.projectRootPath,
        mode,
        branch: branch.trim(),
        baseBranch: baseBranch.trim(),
        provider,
        model,
        modeId: permission,
        modeLabel: permissionMode?.label ?? "",
        thinkingOptionId: thinking,
        thinkingLabel: thinkingOption?.label ?? "",
        extraInstructions: extra,
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData<TaskListOutput>(["tasks"], (old) => replaceTask(old, result.task));
      // Remember this setup, so the next task starts with the same choices.
      if (settings.status === "ready") {
        void settings.save(
          {
            ...settings.values,
            defaultProjectId: project?.projectId ?? settings.values.defaultProjectId,
            defaultMode: mode,
            defaultProvider: provider,
            defaultModel: model,
            defaultPermissionModeId: permission || settings.values.defaultPermissionModeId,
            defaultThinkingOptionId: thinking || settings.values.defaultThinkingOptionId,
          },
          settings.revision,
        );
      }
      toast.show("Agent started", { variant: "success" });
      onStarted(result.agentId);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const inputStyle = {
    color: theme.colors.foreground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface1,
  };
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const showForm = editing;
  const where =
    mode === "worktree"
      ? `New worktree · ${branch.trim() || "no branch name"}`
      : branch.trim()
        ? `Local checkout · new branch ${branch.trim()}`
        : "Local checkout · current branch";
  const agentLine = selectedProvider
    ? [selectedProvider.label, model ? selectedModel?.label : `${selectedModel?.label ?? "default model"} (default)`, thinkingOption?.label]
        .filter(Boolean)
        .join(" · ")
    : providers.isPending
      ? "Loading agents…"
      : "No agent chosen";

  return (
    <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
      <Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "600" }}>Delegate to an agent</Text>

      <View style={{ borderRadius: 10, borderWidth: 1, borderColor: risky ? theme.colors.statusWarning : theme.colors.border, backgroundColor: theme.colors.surface1 }}>
        <SummaryRow theme={theme} label="Project" value={projectName ?? "Not chosen yet"} missing={!projectName} />
        <SummaryRow theme={theme} label="Where" value={where} />
        <SummaryRow theme={theme} label="Agent" value={agentLine} />
        <SummaryRow
          theme={theme}
          label="Mode"
          value={permissionMode?.label ?? "Default"}
          icon={permissionMode?.icon}
          warning={risky}
          last
        />
      </View>
      {risky ? (
        <Text style={{ color: theme.colors.statusWarning, fontSize: 12 }}>
          {permissionMode?.label} lets the agent edit files and run commands without asking you first.
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <Button
          theme={theme}
          icon="Bot"
          label="Start agent"
          busy={mutation.isPending}
          disabled={blocker !== null}
          onPress={() => mutation.mutate()}
        />
        <Button
          theme={theme}
          variant="secondary"
          label={editing ? "Hide options" : "Change"}
          onPress={() => setEditing((value) => !value)}
        />
        {blocker ? <Text style={{ color: theme.colors.statusWarning, fontSize: 12 }}>{blocker}</Text> : null}
      </View>

      {showForm ? (
        <View style={{ gap: 14, paddingTop: 4 }}>
          <View style={{ gap: 6 }}>
            <Label theme={theme}>Project</Label>
            {projects.isPending ? <Text style={muted}>Loading projects…</Text> : null}
            {projects.error ? <Text style={{ color: theme.colors.statusDanger }}>{errorMessage(projects.error)}</Text> : null}
            <ChipRow>
              {(projects.data ?? []).map((entry) => (
                <Chip
                  key={entry.projectId}
                  theme={theme}
                  label={entry.projectCustomName || entry.projectDisplayName}
                  selected={entry.projectId === projectId}
                  onPress={() => setProjectPick(entry.projectId)}
                />
              ))}
            </ChipRow>
          </View>

          <View style={{ gap: 6 }}>
            <Label theme={theme}>Where</Label>
            <ChipRow>
              <Chip theme={theme} label="New worktree" selected={mode === "worktree"} onPress={() => setMode("worktree")} />
              <Chip theme={theme} label="Local checkout" selected={mode === "local"} onPress={() => setMode("local")} />
            </ChipRow>
            <Text style={muted}>
              {mode === "worktree"
                ? "Creates a separate worktree and workspace on a new branch. Your main checkout is not touched."
                : "Adds the agent to the project's existing workspace. Leave the branch empty to stay on the current branch."}
            </Text>
            <TextInput
              value={branch}
              onChangeText={setBranch}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={mode === "worktree" ? "New branch" : "New branch (optional)"}
              placeholder={mode === "worktree" ? "New branch name" : "New branch name (optional)"}
              placeholderTextColor={theme.colors.foregroundMuted}
              style={inputStyle}
            />
            <TextInput
              value={baseBranch}
              onChangeText={setBaseBranch}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Base branch"
              placeholder="Base branch (empty = default)"
              placeholderTextColor={theme.colors.foregroundMuted}
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Label theme={theme}>Agent</Label>
            {providers.error ? <Text style={{ color: theme.colors.statusDanger }}>{errorMessage(providers.error)}</Text> : null}
            <ChipRow>
              {(providers.data ?? []).map((entry) => (
                <Chip
                  key={entry.id}
                  theme={theme}
                  label={entry.label}
                  selected={entry.id === provider}
                  onPress={() => {
                    setProvider(entry.id);
                    setModel("");
                    setPermissionPick(null);
                    setThinkingPick(null);
                    setAllModels(false);
                  }}
                />
              ))}
            </ChipRow>
            {(selectedProvider?.models.length ?? 0) > 0 ? (
              <ChipRow>
                <Chip
                  theme={theme}
                  label="Default model"
                  selected={model === ""}
                  onPress={() => {
                    setModel("");
                    setThinkingPick(null);
                  }}
                />
                {visibleModels.map((entry) => (
                  <Chip
                    key={entry.id}
                    theme={theme}
                    label={entry.label}
                    selected={entry.id === model}
                    onPress={() => {
                      setModel(entry.id);
                      setThinkingPick(null);
                    }}
                  />
                ))}
                {hiddenModelCount > 0 ? (
                  <Chip theme={theme} label={`More models (${hiddenModelCount})`} selected={false} onPress={() => setAllModels(true)} />
                ) : null}
              </ChipRow>
            ) : null}
          </View>

          {selectedModel && selectedModel.thinking.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Label theme={theme}>Thinking</Label>
              <ChipRow>
                {selectedModel.thinking.map((entry) => (
                  <Chip
                    key={entry.id}
                    theme={theme}
                    label={entry.label}
                    selected={entry.id === thinking}
                    onPress={() => setThinkingPick(entry.id)}
                  />
                ))}
              </ChipRow>
            </View>
          ) : null}

          {selectedProvider && selectedProvider.modes.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Label theme={theme}>Mode</Label>
              <ChipRow>
                {selectedProvider.modes.map((entry) => (
                  <Chip
                    key={entry.id}
                    theme={theme}
                    icon={entry.icon}
                    label={entry.label}
                    selected={entry.id === permission}
                    onPress={() => setPermissionPick(entry.id)}
                  />
                ))}
              </ChipRow>
              {permissionMode?.description ? <Text style={muted}>{permissionMode.description}</Text> : null}
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            <Label theme={theme}>Extra instructions (optional)</Label>
            <TextInput
              value={extra}
              onChangeText={setExtra}
              multiline
              accessibilityLabel="Extra instructions"
              placeholder="For example: open a draft PR when done."
              placeholderTextColor={theme.colors.foregroundMuted}
              style={{ ...inputStyle, minHeight: 64, textAlignVertical: "top" }}
            />
            <Text style={muted}>
              The agent always gets the ticket details and rules to update the ticket status in{" "}
              {task.source === "manual" ? "its source app" : SOURCE_LABELS[task.source]} through its MCP tools or API.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SummaryRow({
  theme,
  label,
  value,
  icon,
  missing = false,
  warning = false,
  last = false,
}: {
  theme: Theme;
  label: string;
  value: string;
  icon?: string;
  missing?: boolean;
  warning?: boolean;
  last?: boolean;
}) {
  const color = warning ? theme.colors.statusWarning : missing ? theme.colors.foregroundMuted : theme.colors.foreground;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text style={{ width: 64, color: theme.colors.foregroundMuted, fontSize: 12 }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon && MODE_ICONS.has(icon) ? <Icon name={icon} size={14} color={color} /> : null}
        <Text numberOfLines={2} style={{ flex: 1, color, fontSize: 13, fontWeight: warning ? "600" : "500" }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const MODE_ICONS = new Set(["Shield", "ShieldCheck", "ShieldEllipsis", "ShieldOff", "ShieldPlus", "ShieldAlert"]);

// Modes that let the agent act without asking, such as Claude "Bypass" or Codex "Full Access".
function isRiskyMode(mode: { id: string; label: string } | undefined): boolean {
  if (!mode) return false;
  return /bypass|full.?access|danger|yolo/i.test(`${mode.id} ${mode.label}`);
}

type Option = { id: string; label: string; description?: string; icon?: string };
type ProviderSnapshot = Awaited<ReturnType<ReturnType<typeof usePaseo>["providers"]["snapshot"]>>;

// Providers that can start agents, with their modes, models, and each model's thinking levels.
// Paseo can send models in full form or in a compact form that points to shared thinking sets.
function readProviders(snapshot: ProviderSnapshot) {
  const sets = snapshot.compactSnapshot?.thinkingSets ?? [];
  const compact = new Map((snapshot.compactSnapshot?.entries ?? []).map((entry) => [entry.provider, entry.models ?? []]));
  return snapshot.entries
    .filter((entry) => entry.status === "ready" && entry.enabled !== false)
    .map((entry) => {
      const full = entry.models ?? [];
      const models = full.length
        ? full.map((model) => ({
            id: model.id,
            label: model.label,
            isSelectable: model.isSelectable,
            isDefault: model.isDefault === true,
            thinking: (model.thinkingOptions ?? []) as Option[],
            defaultThinkingId: model.defaultThinkingOptionId ?? model.thinkingOptions?.find((option) => option.isDefault)?.id,
          }))
        : (compact.get(entry.provider) ?? []).map((model) => {
            const set = model.thinkingSet === undefined ? undefined : sets[model.thinkingSet];
            return {
              id: model.id,
              label: model.label,
              isSelectable: model.isSelectable,
              isDefault: model.isDefault === true,
              thinking: (set?.options ?? []) as Option[],
              defaultThinkingId: set?.defaultOptionId ?? set?.options.find((option) => option.isDefault)?.id,
            };
          });
      return {
        id: entry.provider,
        label: entry.label ?? entry.provider,
        modes: (entry.modes ?? []) as Option[],
        defaultModeId: entry.defaultModeId ?? undefined,
        models: models.filter((model) => model.isSelectable !== false),
      };
    });
}

// The explicit pick, then the remembered value, then the default, using the first one this list contains.
function pickValid(options: Option[], ...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    if (candidate && options.some((option) => option.id === candidate)) return candidate;
  }
  return "";
}
