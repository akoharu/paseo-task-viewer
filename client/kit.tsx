import type { PluginHostProps } from "@getpaseo/plugin/client";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { StatusGroup } from "../shared/tasks";

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
