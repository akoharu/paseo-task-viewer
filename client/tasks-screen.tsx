import { type PluginScreenProps, useRpc } from "@getpaseo/plugin/client";
import { Modal, ScrollView, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import {
  Button,
  errorMessage,
  FilterGroup,
  IconButton,
  relativeTime,
  SearchInput,
  Segmented,
  statusColor,
  TaskBadges,
  type Theme,
  Toolbar,
  UnderlineTabs,
} from "./kit";
import { listProjectsRpc } from "../shared/projects";
import { ProjectsView } from "./projects-view";
import { TaskDetail } from "./task-detail";

type SourceFilter = "all" | TaskSource;
type StateFilter = "active" | "done" | "all";

const GROUP_ORDER: StatusGroup[] = ["in_progress", "review", "todo", "done", "canceled"];

type ScreenView = "tasks" | "projects";

export function TasksScreen({ theme, layout, navigation, params }: PluginScreenProps) {
  const [view, setView] = useState<ScreenView>(params.view === "projects" ? "projects" : "tasks");
  // Follow a new view param when the screen is opened again, for example from the Command Center.
  useEffect(() => {
    if (params.view === "projects" || params.view === "tasks") setView(params.view);
  }, [params.view]);

  const listTasks = useRpc(listTasksRpc);
  const listProjects = useRpc(listProjectsRpc);
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => listTasks({}), refetchInterval: 30_000 });
  // Read the project count from the cache only, so the Tasks tab never calls Linear for it.
  const projects = useQuery({ queryKey: ["projects-linear"], queryFn: () => listProjects({ force: false }), enabled: false });

  const tabs = (
    <UnderlineTabs<ScreenView>
      theme={theme}
      value={view}
      onChange={setView}
      options={[
        { value: "tasks", label: "My tasks", count: tasks.data?.tasks.filter((task) => isOpenStatus(task.statusGroup)).length },
        { value: "projects", label: "Projects", count: projects.data?.projects.length },
      ]}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      {view === "tasks" ? (
        <MyTasksView theme={theme} layout={layout} navigation={navigation} tabs={tabs} />
      ) : (
        <ProjectsView theme={theme} layout={layout} tabs={tabs} />
      )}
    </View>
  );
}

function MyTasksView({
  theme,
  layout,
  navigation,
  tabs,
}: Pick<PluginScreenProps, "theme" | "layout" | "navigation"> & { tabs: ReactNode }) {
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
  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((task) =>
      [task.title, task.identifier, task.container, task.project?.name, task.status]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(needle)),
    );
  }, [all, search]);

  const matchesSource = (task: Task, value: SourceFilter) => value === "all" || task.source === value;
  const matchesState = (task: Task, value: StateFilter) =>
    value === "all" || (value === "active" ? isOpenStatus(task.statusGroup) : !isOpenStatus(task.statusGroup));
  // Each count follows the other filter, so the numbers match what a click would show.
  const stateCount = (value: StateFilter) => searched.filter((task) => matchesSource(task, source) && matchesState(task, value)).length;
  const sourceCount = (value: SourceFilter) => searched.filter((task) => matchesState(task, state) && matchesSource(task, value)).length;

  const visible = useMemo(
    () => searched.filter((task) => matchesSource(task, source) && matchesState(task, state)),
    [searched, source, state],
  );

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
  const syncing = Boolean(syncState?.running) || sync.isPending;
  const syncFailed = (syncState?.errors.length ?? 0) > 0;
  const noCredentials = credentials.data && !credentials.data.clickup.configured && !credentials.data.linear.configured;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const padding = layout.compact ? 16 : 24;

  const actions = (
    <>
      {layout.compact ? null : (
        <Text style={{ ...muted, color: syncFailed ? theme.colors.statusDanger : theme.colors.foregroundMuted }}>
          {syncing ? "Syncing…" : syncFailed ? "Sync failed" : `Synced ${relativeTime(syncState?.lastRunAt ?? null)}`}
        </Text>
      )}
      <IconButton theme={theme} icon="RefreshCw" label="Sync now" busy={syncing} onPress={() => sync.mutate()} />
      {layout.compact ? (
        <IconButton theme={theme} icon="Plus" label="New task" variant="primary" onPress={() => setAdding(true)} />
      ) : (
        <Button theme={theme} icon="Plus" label="New task" onPress={() => setAdding(true)} />
      )}
    </>
  );

  const filters = (
    <>
      <View style={layout.compact ? { paddingHorizontal: 16 } : { flexGrow: 1, flexBasis: 220, maxWidth: 420 }}>
        <SearchInput theme={theme} value={search} onChangeText={setSearch} placeholder="Search tasks" />
      </View>
      <FilterGroup layout={layout}>
        <Segmented<StateFilter>
          theme={theme}
          label="State"
          value={state}
          onChange={setState}
          options={[
            { value: "active", label: "Active", count: stateCount("active") },
            { value: "done", label: "Done", count: stateCount("done") },
            { value: "all", label: "All", count: stateCount("all") },
          ]}
        />
        <Segmented<SourceFilter>
          theme={theme}
          label="Source"
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "All sources" },
            { value: "clickup", label: "ClickUp", count: sourceCount("clickup") },
            { value: "linear", label: "Linear", count: sourceCount("linear") },
            { value: "manual", label: "Manual", count: sourceCount("manual") },
          ]}
        />
      </FilterGroup>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <Toolbar theme={theme} layout={layout} tabs={tabs} actions={actions} filters={filters} />
      <ScrollView contentContainerStyle={{ padding, gap: 14 }}>
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

      <Modal title="New task" open={adding} onOpenChange={setAdding}>
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
  const meta = [SOURCE_LABELS[task.source], task.identifier, task.project?.name ?? task.container].filter(Boolean).join(" · ");
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
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={{ color: theme.colors.foreground, fontWeight: "500" }}>
          {task.title}
        </Text>
        <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
          {meta}
          {task.missing ? " · not in your queue" : ""}
        </Text>
        <TaskBadges theme={theme} task={task} />
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
