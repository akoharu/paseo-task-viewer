import type { PluginHostProps } from "@getpaseo/plugin/client";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { cycleLabel, cycleState, isOpenStatus, parseDueDate, type StatusGroup, type Task } from "../shared/tasks";

export type Theme = PluginHostProps["theme"];

export function statusColor(theme: Theme, group: StatusGroup): string {
  switch (group) {
    case "in_progress":
      return theme.colors.accent;
    case "review":
      return theme.colors.statusWarning;
    case "done":
      return theme.colors.statusSuccess;
    case "canceled":
      return theme.colors.statusDanger;
    default:
      return theme.colors.foregroundMuted;
  }
}

export function Chip({
  theme,
  label,
  selected,
  onPress,
}: {
  theme: Theme;
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        backgroundColor: selected ? theme.colors.accent : "transparent",
      }}
    >
      <Text style={{ fontSize: 12, color: selected ? theme.colors.accentForeground : theme.colors.foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{children}</View>;
}

export function Button({
  theme,
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
}: {
  theme: Theme;
  label: string;
  onPress(): void;
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
  disabled?: boolean;
}) {
  const inactive = busy || disabled;
  const background =
    variant === "primary" ? theme.colors.accent : variant === "danger" ? theme.colors.statusDanger : theme.colors.surface2;
  const foreground =
    variant === "primary" ? theme.colors.accentForeground : variant === "danger" ? theme.colors.surface0 : theme.colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: background,
        opacity: inactive ? 0.6 : 1,
      }}
    >
      {busy ? <ActivityIndicator size="small" color={foreground} /> : null}
      <Text style={{ color: foreground, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function Label({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" }}>
      {children}
    </Text>
  );
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function priorityColor(theme: Theme, rank: number | null): string {
  switch (rank) {
    case 1:
      return theme.colors.statusDanger;
    case 2:
      return theme.colors.statusWarning;
    case 3:
      return theme.colors.accent;
    default:
      return theme.colors.foregroundMuted;
  }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function shortDate(date: Date): string {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" });
}

export function dueBadge(theme: Theme, task: Pick<Task, "dueDate" | "statusGroup">): { label: string; color: string } | null {
  if (!task.dueDate) return null;
  const due = parseDueDate(task.dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
  const date = shortDate(due);
  // A finished task is never overdue, so only show the date.
  if (!isOpenStatus(task.statusGroup)) return { label: `Due ${date}`, color: theme.colors.foregroundMuted };
  if (days < 0) return { label: `Overdue · ${date}`, color: theme.colors.statusDanger };
  if (days === 0) return { label: "Due today", color: theme.colors.statusWarning };
  if (days === 1) return { label: "Due tomorrow", color: theme.colors.statusWarning };
  return { label: `Due ${date}`, color: theme.colors.foreground };
}

export function cycleBadge(theme: Theme, task: Pick<Task, "cycle">): { label: string; color: string } | null {
  if (!task.cycle) return null;
  const state = cycleState(task.cycle);
  const color = state === "current" ? theme.colors.accent : theme.colors.foregroundMuted;
  return { label: `${cycleLabel(task.cycle)} · ${state}`, color };
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: color }}>
      <Text numberOfLines={1} style={{ color, fontSize: 11, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

// Priority, deadline, and Linear cycle. Renders nothing when the task has none of them.
export function TaskBadges({ theme, task }: { theme: Theme; task: Task }) {
  const due = dueBadge(theme, task);
  const cycle = cycleBadge(theme, task);
  if (!task.priority && !due && !cycle) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {task.priority ? <Badge label={task.priority} color={priorityColor(theme, task.priorityRank)} /> : null}
      {due ? <Badge label={due.label} color={due.color} /> : null}
      {cycle ? <Badge label={cycle.label} color={cycle.color} /> : null}
    </View>
  );
}
