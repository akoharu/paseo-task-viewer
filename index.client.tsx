import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { SettingsScreen } from "./client/settings-screen";
import { TasksScreen } from "./client/tasks-screen";
import { syncTasksRpc } from "./shared/tasks";

function TasksItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="ListTodo"
      active={currentScreen?.screenId === "tasks"}
      onPress={() => openScreen({ screenId: "tasks" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "tasks", title: "Tasks", Component: TasksScreen });
  client.addSidebarHeaderItem({ id: "tasks", title: "Tasks", Component: TasksItem });
  client.addSettingsScreen({ id: "connections", title: "Task viewer", icon: "ListTodo", Component: SettingsScreen });
  client.addCommandCenterItem({
    id: "open-tasks",
    title: "Open tasks",
    icon: "ListTodo",
    keywords: ["clickup", "linear", "tickets"],
    context: "global",
    onSelect({ openScreen }) {
      openScreen({ screenId: "tasks" });
    },
  });
  client.addCommandCenterItem({
    id: "sync-tasks",
    title: "Sync tasks from ClickUp and Linear",
    icon: "RefreshCw",
    keywords: ["clickup", "linear", "tickets"],
    context: "global",
    async onSelect({ rpc, openScreen }) {
      await rpc(syncTasksRpc, {});
      openScreen({ screenId: "tasks" });
    },
  });
  client.addCommandCenterItem({
    id: "task-settings",
    title: "Task viewer settings",
    icon: "Settings",
    keywords: ["clickup", "linear", "token"],
    context: "global",
    onSelect({ openSettings }) {
      openSettings("connections");
    },
  });
  return () => {};
}
