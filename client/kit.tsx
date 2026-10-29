import type { PluginHostProps } from "@getpaseo/plugin/client";
import { Icon, ScrollView, TextInput } from "@getpaseo/plugin/client/react-native";
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
  icon,
}: {
  theme: Theme;
  label: string;
  onPress(): void;
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
  disabled?: boolean;
  icon?: string;
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
      {busy ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Icon name={icon} size={15} color={foreground} /> : null}
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

export type BadgeSpec = { label: string; color: string };

export function daysUntil(value: string): number | null {
  const date = parseDueDate(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
}

// "Due" for tickets, "Target" for projects. Finished work is never shown as overdue.
export function deadlineBadge(theme: Theme, value: string | null, open: boolean, noun: "Due" | "Target"): BadgeSpec | null {
  if (!value) return null;
  const days = daysUntil(value);
  if (days === null) return null;
  const date = shortDate(parseDueDate(value));
  if (!open) return { label: `${noun} ${date}`, color: theme.colors.foregroundMuted };
  if (days < 0) return { label: `Overdue · ${date}`, color: theme.colors.statusDanger };
  if (days === 0) return { label: `${noun} today`, color: theme.colors.statusWarning };
  if (days === 1) return { label: `${noun} tomorrow`, color: theme.colors.statusWarning };
  if (noun === "Target" && days <= 7) return { label: `${noun} ${date} · ${days} d left`, color: theme.colors.statusWarning };
  return { label: `${noun} ${date}`, color: theme.colors.foreground };
}

export function dueBadge(theme: Theme, task: Pick<Task, "dueDate" | "statusGroup">): BadgeSpec | null {
  return deadlineBadge(theme, task.dueDate, isOpenStatus(task.statusGroup), "Due");
}

export function cycleBadge(theme: Theme, task: Pick<Task, "cycle">): BadgeSpec | null {
  if (!task.cycle) return null;
  const state = cycleState(task.cycle);
  const color = state === "current" ? theme.colors.accent : theme.colors.foregroundMuted;
  return { label: `${cycleLabel(task.cycle)} · ${state}`, color };
}

export function Badge({ label, color }: BadgeSpec) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: color }}>
      <Text numberOfLines={1} style={{ color, fontSize: 11, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

type BadgeFields = Pick<Task, "priority" | "priorityRank" | "dueDate" | "statusGroup" | "cycle">;

// Priority, deadline, and Linear cycle. Renders nothing when the task has none of them.
export function TaskBadges({ theme, task }: { theme: Theme; task: BadgeFields }) {
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

export function ProgressBar({ theme, value, height = 6 }: { theme: Theme; value: number; height?: number }) {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      style={{ height, borderRadius: height / 2, backgroundColor: theme.colors.surface2, overflow: "hidden" }}
    >
      <View
        style={{
          width: `${percent}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: percent >= 100 ? theme.colors.statusSuccess : theme.colors.accent,
        }}
      />
    </View>
  );
}

export function SearchInput({ theme, value, onChangeText, placeholder }: { theme: Theme; value: string; onChangeText(text: string): void; placeholder: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 34,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <Icon name="Search" size={15} color={theme.colors.foregroundMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.foregroundMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ flex: 1, color: theme.colors.foreground, fontSize: 13, paddingVertical: 0 }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => onChangeText("")}>
          <Icon name="X" size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export type Option<T extends string> = { value: T; label: string; count?: number };

// Main navigation: text tabs with an accent underline on the selected one.
export function UnderlineTabs<T extends string>({
  theme,
  options,
  value,
  onChange,
}: {
  theme: Theme;
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 20 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 10,
              borderBottomWidth: 2,
              borderBottomColor: selected ? theme.colors.accent : "transparent",
              marginBottom: -1,
            }}
          >
            <Text style={{ color: selected ? theme.colors.foreground : theme.colors.foregroundMuted, fontSize: 14, fontWeight: selected ? "600" : "500" }}>
              {option.label}
            </Text>
            {option.count !== undefined ? <CountPill theme={theme} count={option.count} selected={selected} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function CountPill({ theme, count, selected }: { theme: Theme; count: number; selected: boolean }) {
  return (
    <View style={{ minWidth: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: selected ? theme.colors.surface2 : theme.colors.surface1 }}>
      <Text style={{ color: selected ? theme.colors.foreground : theme.colors.foregroundMuted, fontSize: 11, fontWeight: "600", textAlign: "center" }}>
        {count}
      </Text>
    </View>
  );
}

// Filters: a neutral segmented control. The selected segment is raised, not colored, so accent stays for actions.
export function Segmented<T extends string>({
  theme,
  options,
  value,
  onChange,
  label,
}: {
  theme: Theme;
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
  label: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        height: 34,
        padding: 3,
        gap: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              borderRadius: 6,
              backgroundColor: selected ? theme.colors.surface2 : "transparent",
            }}
          >
            <Text style={{ color: selected ? theme.colors.foreground : theme.colors.foregroundMuted, fontSize: 12, fontWeight: selected ? "600" : "500" }}>
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{option.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconButton({
  theme,
  icon,
  label,
  onPress,
  busy = false,
  variant = "secondary",
}: {
  theme: Theme;
  icon: string;
  label: string;
  onPress(): void;
  busy?: boolean;
  variant?: "primary" | "secondary";
}) {
  const foreground = variant === "primary" ? theme.colors.accentForeground : theme.colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        borderWidth: variant === "primary" ? 0 : 1,
        borderColor: theme.colors.border,
        backgroundColor: variant === "primary" ? theme.colors.accent : pressed ? theme.colors.surface2 : theme.colors.surface1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={foreground} /> : <Icon name={icon} size={16} color={foreground} />}
    </Pressable>
  );
}

// Sticky header: navigation tabs and actions on top, filters below, a hairline under it.
export function Toolbar({
  theme,
  layout,
  tabs,
  actions,
  filters,
}: {
  theme: Theme;
  layout: PluginHostProps["layout"];
  tabs: ReactNode;
  actions: ReactNode;
  filters: ReactNode;
}) {
  const padding = layout.compact ? 16 : 24;
  return (
    <View style={{ backgroundColor: theme.colors.surface0, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingHorizontal: padding,
          paddingTop: layout.compact ? 4 : 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        {tabs}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{actions}</View>
      </View>
      {layout.compact ? (
        <View style={{ gap: 8, paddingVertical: 10 }}>{filters}</View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, paddingHorizontal: padding, paddingVertical: 12 }}>
          {filters}
        </View>
      )}
    </View>
  );
}

// On compact screens, filters scroll sideways instead of wrapping into many rows.
export function FilterGroup({ layout, children }: { layout: PluginHostProps["layout"]; children: ReactNode }) {
  if (!layout.compact) return <>{children}</>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0 }}>
      {children}
    </ScrollView>
  );
}
