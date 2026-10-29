import { openExternalUrl, type PluginSurfaceProps, usePaseo, useRpc, useSettings } from "@getpaseo/plugin/client";
import { TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { taskViewerSettings } from "../shared/settings";
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
import { Button, Chip, ChipRow, errorMessage, Label, relativeTime, statusColor, type Theme } from "./kit";

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
          {[SOURCE_LABELS[task.source], task.identifier, task.container].filter(Boolean).join(" · ")}
        </Text>
        <Text selectable style={{ ...text, fontSize: layout.compact ? 18 : 20, fontWeight: "600" }}>
          {task.title}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: task.statusColor ?? statusColor(theme, task.statusGroup) }} />
          <Text style={{ color: statusColor(theme, task.statusGroup), fontWeight: "600" }}>{task.status}</Text>
          {task.priority ? <Text style={muted}>Priority: {task.priority}</Text> : null}
          {task.dueDate ? <Text style={muted}>Due: {task.dueDate.slice(0, 10)}</Text> : null}
          {task.syncedAt ? <Text style={muted}>Synced {relativeTime(task.syncedAt)}</Text> : null}
        </View>
        {task.missing ? (
          <Text style={{ color: theme.colors.statusWarning, fontSize: 12 }}>
            This ticket is no longer in your assigned queue (unassigned, filtered out, or deleted).
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
        <Text selectable style={{ ...text, lineHeight: 20 }}>
          {task.description.trim() || "No description."}
        </Text>
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
                  {[assignment.branch, assignment.provider, relativeTime(assignment.createdAt)].filter(Boolean).join(" · ")}
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

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await paseo.projects.list()).projects.filter((project) => project.projectKind === "git"),
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const snapshot = await paseo.providers.snapshot();
      const compactModels = new Map(
        (snapshot.compactSnapshot?.entries ?? []).map((entry) => [entry.provider, entry.models ?? []]),
      );
      return snapshot.entries
        .filter((entry) => entry.status === "ready" && entry.enabled !== false)
        .map((entry) => ({
          id: entry.provider,
          label: entry.label ?? entry.provider,
          models: (entry.models?.length ? entry.models : (compactModels.get(entry.provider) ?? []))
            .filter((model) => model.isSelectable !== false)
            .map((model) => ({ id: model.id, label: model.label, isDefault: model.isDefault === true })),
        }));
    },
  });

  const [projectId, setProjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<DelegationMode>("worktree");
  const [branch, setBranch] = useState(() => suggestBranchName(task));
  const [baseBranch, setBaseBranch] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [extra, setExtra] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Seed the form from saved defaults once they load.
  useEffect(() => {
    if (initialized || settings.status !== "ready") return;
    setMode(settings.values.defaultMode);
    setProvider(settings.values.defaultProvider);
    setModel(settings.values.defaultModel);
    setExtra(settings.values.agentInstructions);
    setInitialized(true);
  }, [initialized, settings]);

  const selectedProvider = providers.data?.find((entry) => entry.id === provider);
  const project = projects.data?.find((entry) => entry.projectId === projectId);
  const visibleModels = useMemo(() => (selectedProvider?.models ?? []).slice(0, 12), [selectedProvider]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!project) throw new Error("Choose a project first.");
      return delegate({
        taskId: task.id,
        projectId: project.projectId,
        projectName: project.projectCustomName || project.projectDisplayName,
        projectPath: project.projectRootPath,
        mode,
        branch: branch.trim(),
        baseBranch: baseBranch.trim(),
        provider,
        model,
        extraInstructions: extra,
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData<TaskListOutput>(["tasks"], (old) => replaceTask(old, result.task));
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

  return (
    <View style={{ gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
      <Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "600" }}>Delegate to an agent</Text>

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
              onPress={() => setProjectId(entry.projectId)}
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
      </View>

      <View style={{ gap: 6 }}>
        <Label theme={theme}>{mode === "worktree" ? "New branch" : "New branch (optional)"}</Label>
        <TextInput
          value={branch}
          onChangeText={setBranch}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="feature-branch-name"
          placeholderTextColor={theme.colors.foregroundMuted}
          style={inputStyle}
        />
        <TextInput
          value={baseBranch}
          onChangeText={setBaseBranch}
          autoCapitalize="none"
          autoCorrect={false}
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
              }}
            />
          ))}
        </ChipRow>
        {visibleModels.length > 0 ? (
          <ChipRow>
            <Chip theme={theme} label="Default model" selected={model === ""} onPress={() => setModel("")} />
            {visibleModels.map((entry) => (
              <Chip key={entry.id} theme={theme} label={entry.label} selected={entry.id === model} onPress={() => setModel(entry.id)} />
            ))}
          </ChipRow>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <Label theme={theme}>Extra instructions (optional)</Label>
        <TextInput
          value={extra}
          onChangeText={setExtra}
          multiline
          placeholder="For example: open a draft PR when done."
          placeholderTextColor={theme.colors.foregroundMuted}
          style={{ ...inputStyle, minHeight: 64, textAlignVertical: "top" }}
        />
        <Text style={muted}>
          The agent always gets the ticket details and rules to update the ticket status in{" "}
          {task.source === "manual" ? "its source app" : SOURCE_LABELS[task.source]} through its MCP tools or API.
        </Text>
      </View>

      <View style={{ flexDirection: "row" }}>
        <Button
          theme={theme}
          label="Start agent"
          busy={mutation.isPending}
          disabled={!project || !provider || (mode === "worktree" && !branch.trim())}
          onPress={() => mutation.mutate()}
        />
      </View>
    </View>
  );
}
