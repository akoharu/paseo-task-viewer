import { openExternalUrl, type PluginScreenProps, useRpc } from "@getpaseo/plugin/client";
import { Modal, ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getProjectRpc, type ProjectIssue } from "../shared/projects";
import { isOpenStatus, listTasksRpc, parseDueDate, STATUS_GROUP_LABELS, type StatusGroup } from "../shared/tasks";
import {
  Badge,
  Button,
  deadlineBadge,
  errorMessage,
  Label,
  ProgressBar,
  relativeTime,
  SearchInput,
  Segmented,
  shortDate,
  statusColor,
  TaskBadges,
  type Theme,
} from "./kit";
import { doneLabel, openCount, ProjectBadges, stageLine, statusTypeColor } from "./projects-view";
import { TaskDetail } from "./task-detail";

type StateFilter = "open" | "done" | "all";
type PersonFilter = "everyone" | "mine" | "unassigned";

const GROUP_ORDER: StatusGroup[] = ["in_progress", "review", "todo", "done", "canceled"];

// Urgent first, no priority last, then the closest due date.
function compareIssues(a: ProjectIssue, b: ProjectIssue): number {
  const rank = (a.priorityRank ?? 5) - (b.priorityRank ?? 5);
  if (rank !== 0) return rank;
  const aDue = a.dueDate ? Date.parse(a.dueDate) : Infinity;
  const bDue = b.dueDate ? Date.parse(b.dueDate) : Infinity;
  if (aDue !== bDue) return aDue - bDue;
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

export function ProjectScreen({ theme, layout, navigation, params }: PluginScreenProps) {
  const projectId = params.projectId ?? "";
  const queryClient = useQueryClient();
  const toast = useToast();
  const getProject = useRpc(getProjectRpc);
  const listTasks = useRpc(listTasksRpc);

  const detail = useQuery({
    queryKey: ["project-linear", projectId],
    queryFn: () => getProject({ projectId, force: false }),
    enabled: projectId.length > 0,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  // Your synced tasks, so an issue that is yours opens the full task view with delegation.
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => listTasks({}), refetchInterval: 30_000 });
  const refresh = useMutation({
    mutationFn: () => getProject({ projectId, force: true }),
    onSuccess: (data) => queryClient.setQueryData(["project-linear", projectId], data),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [person, setPerson] = useState<PersonFilter>("everyone");
  const [search, setSearch] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const issues = detail.data?.issues ?? [];
  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const visible = issues.filter((issue) => {
      if (stateFilter === "open" && !isOpenStatus(issue.statusGroup)) return false;
      if (stateFilter === "done" && isOpenStatus(issue.statusGroup)) return false;
      if (person === "mine" && !issue.assignedToMe) return false;
      if (person === "unassigned" && issue.assigneeName) return false;
      if (!needle) return true;
      return [issue.identifier, issue.title, issue.assigneeName, issue.status, issue.milestone].some((value) =>
        value?.toLowerCase().includes(needle),
      );
    });
    return GROUP_ORDER.map((group) => ({
      group,
      issues: visible.filter((issue) => issue.statusGroup === group).sort(compareIssues),
    })).filter((entry) => entry.issues.length > 0);
  }, [issues, stateFilter, person, search]);

  const selectedIssue = issues.find((issue) => issue.id === selectedId) ?? null;
  const selectedTask = selectedIssue ? tasks.data?.tasks.find((task) => task.id === `linear:${selectedIssue.id}`) ?? null : null;
  const project = detail.data?.project;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const padding = layout.compact ? 16 : 24;

  if (!projectId) {
    return (
      <View style={{ flex: 1, padding, backgroundColor: theme.colors.surface0 }}>
        <Text style={{ color: theme.colors.foreground }}>No project selected. Open one from the Projects tab.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <ScrollView contentContainerStyle={{ padding, gap: 16 }}>
        {detail.isPending ? <Text style={muted}>Loading project from Linear…</Text> : null}
        {detail.error ? <Text style={{ color: theme.colors.statusDanger }}>{errorMessage(detail.error)}</Text> : null}

        {project ? (
          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.foreground, fontSize: layout.compact ? 20 : 24, fontWeight: "700" }}>
              {project.name}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Badge label={project.statusName} color={statusTypeColor(theme, project.statusType)} />
              {project.startDate ? <Badge label={`Started ${shortDate(parseDueDate(project.startDate))}`} color={theme.colors.foregroundMuted} /> : null}
            </View>
            <ProjectBadges theme={theme} project={project} />
            <ProgressBar theme={theme} value={project.progress} height={8} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>
                {Math.round(project.progress * 100)}% · {doneLabel(project)}
              </Text>
              <Text style={muted}>
                {stageLine(project)}
                {project.counts.canceled ? ` · ${project.counts.canceled} canceled` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Button
                theme={theme}
                variant="secondary"
                label="Open in Linear"
                onPress={() => void openExternalUrl(project.url).catch((error) => toast.error(errorMessage(error)))}
              />
              <Button theme={theme} variant="secondary" label="Refresh" busy={refresh.isPending} onPress={() => refresh.mutate()} />
              <Text style={muted}>Updated {relativeTime(detail.data?.fetchedAt ?? null)}</Text>
            </View>
            {project.description ? (
              <Pressable accessibilityRole="button" onPress={() => setShowDescription((value) => !value)}>
                <Text selectable numberOfLines={showDescription ? undefined : 3} style={{ color: theme.colors.foreground, lineHeight: 20 }}>
                  {project.description}
                </Text>
                <Text style={{ ...muted, marginTop: 2 }}>{showDescription ? "Show less" : "Show more"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {detail.data && detail.data.milestones.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Label theme={theme}>Milestones</Label>
            {detail.data.milestones.map((milestone) => {
              const target = deadlineBadge(theme, milestone.targetDate, milestone.progress < 1, "Target");
              return (
                <View key={milestone.name} style={{ gap: 6, padding: 10, borderRadius: 8, backgroundColor: theme.colors.surface1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <Text style={{ color: theme.colors.foreground, fontWeight: "500", flexShrink: 1 }}>{milestone.name}</Text>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {target ? <Badge {...target} /> : null}
                      <Text style={muted}>{Math.round(milestone.progress * 100)}%</Text>
                    </View>
                  </View>
                  <ProgressBar theme={theme} value={milestone.progress} height={4} />
                </View>
              );
            })}
          </View>
        ) : null}

        {project ? (
          <View style={{ gap: 10 }}>
            <Label theme={theme}>Issues</Label>
            <SearchInput theme={theme} value={search} onChangeText={setSearch} placeholder="Search by ID, title, assignee, or status" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Segmented<StateFilter>
                theme={theme}
                label="Issue state"
                value={stateFilter}
                onChange={setStateFilter}
                options={[
                  { value: "open", label: "Open", count: openCount(project) },
                  { value: "done", label: "Done", count: project.counts.done },
                  { value: "all", label: "All", count: project.counts.total },
                ]}
              />
              <Segmented<PersonFilter>
                theme={theme}
                label="Assignee"
                value={person}
                onChange={setPerson}
                options={[
                  { value: "everyone", label: "Everyone" },
                  { value: "mine", label: "Mine", count: project.counts.mine },
                  { value: "unassigned", label: "Unassigned", count: project.counts.unassigned },
                ]}
              />
            </View>
            {groups.length === 0 ? <Text style={muted}>No issues match these filters.</Text> : null}
          </View>
        ) : null}

        {groups.map(({ group, issues: groupIssues }) => (
          <View key={group} style={{ gap: 6 }}>
            <Text style={{ color: statusColor(theme, group), fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              {STATUS_GROUP_LABELS[group]} · {groupIssues.length}
            </Text>
            {groupIssues.map((issue) => (
              <IssueRow key={issue.id} theme={theme} issue={issue} onPress={() => setSelectedId(issue.id)} />
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal
        title={selectedIssue?.identifier ?? "Issue"}
        open={selectedIssue !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <Modal.Content>
          {selectedTask ? (
            <TaskDetail theme={theme} layout={layout} navigation={navigation} task={selectedTask} onClose={() => setSelectedId(null)} />
          ) : selectedIssue ? (
            <IssueDetail theme={theme} issue={selectedIssue} />
          ) : null}
        </Modal.Content>
      </Modal>
    </View>
  );
}

function IssueRow({ theme, issue, onPress }: { theme: Theme; issue: ProjectIssue; onPress(): void }) {
  const assignee = issue.assigneeName ? `${issue.assigneeName}${issue.assignedToMe ? " (you)" : ""}` : "Unassigned";
  const meta = [issue.identifier, assignee, issue.milestone].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.identifier} ${issue.title}, ${issue.status}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: issue.assignedToMe ? theme.colors.accent : theme.colors.border,
        backgroundColor: pressed ? theme.colors.surface2 : theme.colors.surface1,
      })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: issue.statusColor ?? statusColor(theme, issue.statusGroup) }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={{ color: theme.colors.foreground, fontWeight: "500" }}>
          {issue.title}
        </Text>
        <Text numberOfLines={1} style={{ color: issue.assigneeName ? theme.colors.foregroundMuted : theme.colors.statusWarning, fontSize: 12 }}>
          {meta}
        </Text>
        <TaskBadges theme={theme} task={issue} />
      </View>
      <Text numberOfLines={1} style={{ color: statusColor(theme, issue.statusGroup), fontSize: 12, fontWeight: "600", maxWidth: 120 }}>
        {issue.status}
      </Text>
    </Pressable>
  );
}

function IssueDetail({ theme, issue }: { theme: Theme; issue: ProjectIssue }) {
  const toast = useToast();
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Text style={muted}>{[issue.identifier, issue.assigneeName ?? "Unassigned", issue.milestone].filter(Boolean).join(" · ")}</Text>
        <Text selectable style={{ color: theme.colors.foreground, fontSize: 18, fontWeight: "600" }}>
          {issue.title}
        </Text>
        <Text style={{ color: statusColor(theme, issue.statusGroup), fontWeight: "600" }}>{issue.status}</Text>
        <TaskBadges theme={theme} task={issue} />
        {issue.estimate !== null ? <Text style={muted}>Estimate: {issue.estimate}</Text> : null}
      </View>
      <View style={{ flexDirection: "row" }}>
        <Button
          theme={theme}
          variant="secondary"
          label="Open in Linear"
          onPress={() => void openExternalUrl(issue.url).catch((error) => toast.error(errorMessage(error)))}
        />
      </View>
      <View style={{ gap: 6 }}>
        <Label theme={theme}>Description</Label>
        <Text selectable style={{ color: theme.colors.foreground, lineHeight: 20 }}>
          {issue.description.trim() || "No description."}
        </Text>
      </View>
      <Text style={muted}>
        {issue.assignedToMe
          ? "This issue is yours but is not synced yet. Press Sync now on the Tasks tab to delegate it to an agent."
          : "Only issues assigned to you can be delegated to an agent from Paseo."}
      </Text>
    </View>
  );
}
