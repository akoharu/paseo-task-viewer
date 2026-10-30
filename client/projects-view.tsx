import { type PluginSurfaceProps, useRpc } from "@getpaseo/plugin/client";
import { ScrollView } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { HEALTH_LABELS, listProjectsRpc, type ProjectSummary } from "../shared/projects";
import {
  Badge,
  type BadgeSpec,
  daysUntil,
  deadlineBadge,
  errorMessage,
  FilterGroup,
  IconButton,
  ProgressBar,
  relativeTime,
  SearchInput,
  Segmented,
  type Theme,
  Toolbar,
} from "./kit";
import { openProjectInput, useOpenScreen } from "./navigation";

type Scope = "all" | "lead" | "mine";

export function openCount(project: ProjectSummary): number {
  return project.counts.todo + project.counts.inProgress + project.counts.review;
}

// Done out of all non-canceled issues, so canceled work does not hide progress.
export function doneLabel(project: ProjectSummary): string {
  const counted = project.counts.total - project.counts.canceled;
  return counted > 0 ? `${project.counts.done} of ${counted} done` : "No issues";
}

// Overdue with open work, or marked at risk or off track.
export function needsAttention(project: ProjectSummary): boolean {
  if (openCount(project) === 0) return false;
  const days = project.targetDate ? daysUntil(project.targetDate) : null;
  return (days !== null && days < 0) || project.health === "atRisk" || project.health === "offTrack";
}

function compareProjects(a: ProjectSummary, b: ProjectSummary): number {
  const attention = Number(needsAttention(b)) - Number(needsAttention(a));
  if (attention !== 0) return attention;
  const aDays = a.targetDate ? (daysUntil(a.targetDate) ?? Infinity) : Infinity;
  const bDays = b.targetDate ? (daysUntil(b.targetDate) ?? Infinity) : Infinity;
  if (aDays !== bDays) return aDays - bDays;
  if (a.counts.mine !== b.counts.mine) return b.counts.mine - a.counts.mine;
  return openCount(b) - openCount(a);
}

export function statusTypeColor(theme: Theme, type: ProjectSummary["statusType"]): string {
  switch (type) {
    case "started":
      return theme.colors.accent;
    case "paused":
      return theme.colors.statusWarning;
    case "completed":
      return theme.colors.statusSuccess;
    case "canceled":
      return theme.colors.statusDanger;
    default:
      return theme.colors.foregroundMuted;
  }
}

export function healthBadge(theme: Theme, project: ProjectSummary): BadgeSpec | null {
  if (!project.health) return null;
  const color =
    project.health === "onTrack"
      ? theme.colors.statusSuccess
      : project.health === "atRisk"
        ? theme.colors.statusWarning
        : theme.colors.statusDanger;
  return { label: HEALTH_LABELS[project.health], color };
}

export function stageLine(project: ProjectSummary): string {
  const parts = [
    project.counts.inProgress ? `${project.counts.inProgress} in progress` : null,
    project.counts.review ? `${project.counts.review} in review` : null,
    project.counts.todo ? `${project.counts.todo} to do` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No open issues";
}

export function ProjectsView({ theme, layout, tabs }: Pick<PluginSurfaceProps, "theme" | "layout"> & { tabs: ReactNode }) {
  const queryClient = useQueryClient();
  const listProjects = useRpc(listProjectsRpc);
  const openScreen = useOpenScreen();
  const projects = useQuery({
    queryKey: ["projects-linear"],
    queryFn: () => listProjects({ force: false }),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const refresh = useMutation({
    mutationFn: () => listProjects({ force: true }),
    onSuccess: (data) => queryClient.setQueryData(["projects-linear"], data),
  });

  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [showQuiet, setShowQuiet] = useState(false);

  const { active, quiet, attention, myOpen, scopeCounts } = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = projects.data?.projects ?? [];
    const searched = needle
      ? all.filter((project) =>
          [project.name, project.statusName, project.leadName].some((value) => value?.toLowerCase().includes(needle)),
        )
      : all;
    const inScope = (project: ProjectSummary, value: Scope) =>
      value === "all" || (value === "lead" ? project.isLead : project.counts.mine > 0);
    const filtered = searched.filter((project) => inScope(project, scope));
    return {
      scopeCounts: {
        all: searched.length,
        lead: searched.filter((project) => inScope(project, "lead")).length,
        mine: searched.filter((project) => inScope(project, "mine")).length,
      },
      active: filtered.filter((project) => openCount(project) > 0).sort(compareProjects),
      quiet: filtered.filter((project) => openCount(project) === 0).sort((a, b) => a.name.localeCompare(b.name)),
      attention: all.filter(needsAttention).length,
      myOpen: all.reduce((sum, project) => sum + project.counts.mine, 0),
    };
  }, [projects.data, scope, search]);

  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const padding = layout.compact ? 16 : 24;
  const open = (project: ProjectSummary) => openScreen?.(openProjectInput(project));

  const actions = (
    <>
      {layout.compact || !projects.data ? null : <Text style={muted}>Updated {relativeTime(projects.data.fetchedAt)}</Text>}
      <IconButton theme={theme} icon="RefreshCw" label="Refresh projects" busy={refresh.isPending} onPress={() => refresh.mutate()} />
    </>
  );

  const filters = (
    <>
      <View style={layout.compact ? { paddingHorizontal: 16 } : { flexGrow: 1, flexBasis: 220, maxWidth: 420 }}>
        <SearchInput theme={theme} value={search} onChangeText={setSearch} placeholder="Search projects, status, or lead" />
      </View>
      <FilterGroup layout={layout}>
        <Segmented<Scope>
          theme={theme}
          label="Projects to show"
          value={scope}
          onChange={setScope}
          options={[
            { value: "all", label: "All", count: scopeCounts.all },
            { value: "lead", label: "I lead", count: scopeCounts.lead },
            { value: "mine", label: "Has my issues", count: scopeCounts.mine },
          ]}
        />
      </FilterGroup>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
    <Toolbar theme={theme} layout={layout} tabs={tabs} actions={actions} filters={filters} />
    <ScrollView contentContainerStyle={{ padding, gap: 14 }}>
      {projects.error || refresh.error ? (
        <Text style={{ color: theme.colors.statusDanger }}>{errorMessage(refresh.error ?? projects.error)}</Text>
      ) : null}
      {projects.data ? (
        <Text style={muted}>
          {attention > 0 ? `${attention} ${attention === 1 ? "needs" : "need"} attention · ` : ""}
          {myOpen === 1 ? "1 open issue is yours" : `${myOpen} open issues are yours`} · Linear projects you lead, are a
          member of, or have issues in
        </Text>
      ) : null}

      {projects.isPending ? <Text style={muted}>Loading projects from Linear…</Text> : null}
      {projects.data && active.length === 0 && quiet.length === 0 ? <Text style={muted}>No projects match these filters.</Text> : null}

      {active.map((project) => (
        <ProjectCard key={project.id} theme={theme} project={project} onPress={() => open(project)} />
      ))}

      {quiet.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => setShowQuiet((value) => !value)} style={{ paddingVertical: 4 }}>
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              {showQuiet ? "▾" : "▸"} No open issues · {quiet.length}
            </Text>
          </Pressable>
          {showQuiet
            ? quiet.map((project) => <ProjectCard key={project.id} theme={theme} project={project} onPress={() => open(project)} />)
            : null}
        </View>
      ) : null}

    </ScrollView>
    </View>
  );
}

export function ProjectBadges({ theme, project }: { theme: Theme; project: ProjectSummary }) {
  const health = healthBadge(theme, project);
  const target = deadlineBadge(theme, project.targetDate, openCount(project) > 0, "Target");
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {health ? <Badge {...health} /> : null}
      {target ? <Badge {...target} /> : null}
      {project.counts.mine > 0 ? <Badge label={`${project.counts.mine} yours`} color={theme.colors.accent} /> : null}
      {project.counts.unassigned > 0 ? (
        <Badge label={`${project.counts.unassigned} unassigned`} color={theme.colors.statusWarning} />
      ) : null}
      <Badge label={project.isLead ? "You lead" : `Lead: ${project.leadName ?? "none"}`} color={theme.colors.foregroundMuted} />
    </View>
  );
}

function ProjectCard({ theme, project, onPress }: { theme: Theme; project: ProjectSummary; onPress(): void }) {
  const attention = needsAttention(project);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${project.statusName}, ${Math.round(project.progress * 100)} percent`}
      onPress={onPress}
      style={({ pressed }) => ({
        gap: 8,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: attention ? theme.colors.statusDanger : theme.colors.border,
        backgroundColor: pressed ? theme.colors.surface2 : theme.colors.surface1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <Text numberOfLines={2} style={{ flex: 1, color: theme.colors.foreground, fontSize: 15, fontWeight: "600" }}>
          {project.name}
        </Text>
        <Badge label={project.statusName} color={statusTypeColor(theme, project.statusType)} />
      </View>
      <ProgressBar theme={theme} value={project.progress} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "600" }}>
          {Math.round(project.progress * 100)}% · {doneLabel(project)}
        </Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{stageLine(project)}</Text>
      </View>
      <ProjectBadges theme={theme} project={project} />
    </Pressable>
  );
}
