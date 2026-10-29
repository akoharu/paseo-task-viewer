import { type PluginScreenProps, useRpc } from "@getpaseo/plugin/client";
import { Modal, ScrollView, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  createTaskRpc,
  credentialStatusRpc,
  isOpenStatus,
  listTasksRpc,
  SOURCE_LABELS,
  STATUS_GROUP_LABELS,
  type StatusGroup,
  syncTasksRpc,
  type Task,
  type TaskListOutput,
  type TaskSource,
} from "../shared/tasks";
import { Button, Chip, ChipRow, errorMessage, relativeTime, statusColor, type Theme } from "./kit";
import { TaskDetail } from "./task-detail";

type SourceFilter = "all" | TaskSource;
type StateFilter = "active" | "done" | "all";

const GROUP_ORDER: StatusGroup[] = ["in_progress", "review", "todo", "done", "canceled"];

export function TasksScreen({ theme, layout, navigation }: PluginScreenProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const listTasks = useRpc(listTasksRpc);
  const syncTasks = useRpc(syncTasksRpc);
  const credentialStatus = useRpc(credentialStatusRpc);

  // Poll so scheduled syncs on the daemon show up without a manual refresh.
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => listTasks({}), refetchInterval: 30_000 });
  const credentials = useQuery({ queryKey: ["credentials"], queryFn: () => credentialStatus({}) });
  const sync = useMutation({
    mutationFn: () => syncTasks({}),
    onSuccess: (data) => {
      queryClient.setQueryData(["tasks"], data);
      if (data.sync.errors.length === 0) toast.show("Tasks synced", { variant: "success" });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const [source, setSource] = useState<SourceFilter>("all");
  const [state, setState] = useState<StateFilter>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const all = tasks.data?.tasks ?? [];
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter((task) => {
      if (source !== "all" && task.source !== source) return false;
      if (state === "active" && !isOpenStatus(task.statusGroup)) return false;
      if (state === "done" && isOpenStatus(task.statusGroup)) return false;
      if (!needle) return true;
      return [task.title, task.identifier, task.container, task.status]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(needle));
    });
  }, [all, source, state, search]);

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        tasks: visible
          .filter((task) => task.statusGroup === group)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      })).filter((entry) => entry.tasks.length > 0),
    [visible],
  );

  const selected = all.find((task) => task.id === selectedId) ?? null;
  const syncState = tasks.data?.sync;
  const noCredentials = credentials.data && !credentials.data.clickup.configured && !credentials.data.linear.configured;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const padding = layout.compact ? 16 : 24;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <ScrollView contentContainerStyle={{ padding, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: theme.colors.foreground, fontSize: layout.compact ? 20 : 24, fontWeight: "700" }}>Tasks</Text>
            <Text style={muted}>
              {syncState?.running || sync.isPending
                ? "Syncing…"
                : `Last sync ${relativeTime(syncState?.lastRunAt ?? null)}`}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button theme={theme} variant="secondary" label="Sync now" busy={sync.isPending} onPress={() => sync.mutate()} />
            <Button theme={theme} label="Add task" onPress={() => setAdding(true)} />
          </View>
        </View>

        {noCredentials ? (
          <Text style={{ color: theme.colors.statusWarning }}>
            ClickUp and Linear are not connected. Open Settings → Plugins → task-viewer to add your API tokens. Manual tasks work without them.
          </Text>
        ) : null}
        {syncState?.errors.map((message) => (
          <Text key={message} style={{ color: theme.colors.statusDanger, fontSize: 12 }}>
            {message}
          </Text>
        ))}
        {tasks.error ? <Text style={{ color: theme.colors.statusDanger }}>{errorMessage(tasks.error)}</Text> : null}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by title, ID, list, or status"
          placeholderTextColor={theme.colors.foregroundMuted}
          autoCapitalize="none"
          style={{
            color: theme.colors.foreground,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            backgroundColor: theme.colors.surface1,
          }}
        />
        <ChipRow>
          {(["all", "clickup", "linear", "manual"] as const).map((value) => (
            <Chip
              key={value}
              theme={theme}
              label={value === "all" ? "All sources" : SOURCE_LABELS[value]}
              selected={source === value}
              onPress={() => setSource(value)}
            />
          ))}
        </ChipRow>
        <ChipRow>
          <Chip theme={theme} label="Active" selected={state === "active"} onPress={() => setState("active")} />
          <Chip theme={theme} label="Done" selected={state === "done"} onPress={() => setState("done")} />
          <Chip theme={theme} label="All" selected={state === "all"} onPress={() => setState("all")} />
        </ChipRow>

        {tasks.isPending ? <Text style={muted}>Loading tasks…</Text> : null}
        {!tasks.isPending && groups.length === 0 ? <Text style={muted}>No tasks match these filters.</Text> : null}

        {groups.map(({ group, tasks: groupTasks }) => (
          <View key={group} style={{ gap: 6 }}>
            <Text style={{ color: statusColor(theme, group), fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              {STATUS_GROUP_LABELS[group]} · {groupTasks.length}
            </Text>
            {groupTasks.map((task) => (
              <TaskRow key={task.id} theme={theme} task={task} onPress={() => setSelectedId(task.id)} />
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal title={selected?.identifier ?? "Task"} open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <Modal.Content>
          {selected ? (
            <TaskDetail theme={theme} layout={layout} navigation={navigation} task={selected} onClose={() => setSelectedId(null)} />
          ) : null}
        </Modal.Content>
      </Modal>

      <Modal title="Add task" open={adding} onOpenChange={setAdding}>
        <Modal.Content>
          <AddTaskForm
            theme={theme}
            onCreated={(task) => {
              queryClient.setQueryData<TaskListOutput>(["tasks"], (old) =>
                old ? { ...old, tasks: [task, ...old.tasks] } : old,
              );
              setAdding(false);
              setSelectedId(task.id);
            }}
          />
        </Modal.Content>
      </Modal>
    </View>
  );
}

function TaskRow({ theme, task, onPress }: { theme: Theme; task: Task; onPress(): void }) {
  const meta = [SOURCE_LABELS[task.source], task.identifier, task.container].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${task.status}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surface2 : theme.colors.surface1,
      })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: task.statusColor ?? statusColor(theme, task.statusGroup) }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={{ color: theme.colors.foreground, fontWeight: "500" }}>
          {task.title}
        </Text>
        <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
          {meta}
          {task.missing ? " · not in your queue" : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text numberOfLines={1} style={{ color: statusColor(theme, task.statusGroup), fontSize: 12, fontWeight: "600" }}>
          {task.status}
        </Text>
        {task.assignments.length > 0 ? (
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
            {task.assignments.length} agent{task.assignments.length > 1 ? "s" : ""}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function AddTaskForm({ theme, onCreated }: { theme: Theme; onCreated(task: Task): void }) {
  const toast = useToast();
  const createTask = useRpc(createTaskRpc);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const mutation = useMutation({
    mutationFn: () => createTask({ title, description, url: url.trim() || null }),
    onSuccess: ({ task }) => onCreated(task),
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
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={theme.colors.foregroundMuted}
        style={inputStyle}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Description: what needs to be done, acceptance criteria, links"
        placeholderTextColor={theme.colors.foregroundMuted}
        style={{ ...inputStyle, minHeight: 120, textAlignVertical: "top" }}
      />
      <TextInput
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Link (optional), for example a Slack thread"
        placeholderTextColor={theme.colors.foregroundMuted}
        style={inputStyle}
      />
      <View style={{ flexDirection: "row" }}>
        <Button
          theme={theme}
          label="Create task"
          busy={mutation.isPending}
          disabled={!title.trim()}
          onPress={() => mutation.mutate()}
        />
      </View>
    </View>
  );
}
