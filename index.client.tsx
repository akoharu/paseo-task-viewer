import type { PluginClientContext, PluginScreenProps, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import type { ComponentType } from "react";
import { OpenScreenContext } from "./client/navigation";
import { ProjectScreen } from "./client/project-screen";
import { SettingsScreen } from "./client/settings-screen";
import { TasksScreen } from "./client/tasks-screen";
import { syncTasksRpc } from "./shared/tasks";

function TasksItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="ListTodo"
      active={currentScreen?.screenId === "tasks" || currentScreen?.screenId === "project"}
      onPress={() => openScreen({ screenId: "tasks" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  const openScreen: PluginClientContext["openScreen"] = (input) => client.openScreen(input);
  // Screens get openScreen through context, so a task or project card can open the project screen.
  const withNavigation = (Screen: ComponentType<PluginScreenProps>) =>
    function NavigableScreen(props: PluginScreenProps) {
      return (
        <OpenScreenContext.Provider value={openScreen}>
          <Screen {...props} />
        </OpenScreenContext.Provider>
      );
    };

  client.addScreen({ id: "tasks", title: "Tasks", Component: withNavigation(TasksScreen) });
  client.addScreen({
    id: "project",
    title: (params) => params.name || "Project",
    Component: withNavigation(ProjectScreen),
  });
  client.addSidebarHeaderItem({ id: "tasks", title: "Tasks", Component: TasksItem });
  client.addSettingsScreen({ id: "connections", title: "Task viewer", icon: "ListTodo", Component: SettingsScreen });
  client.addCommandCenterItem({
    id: "open-tasks",
    title: "Open tasks",
    icon: "ListTodo",
    keywords: ["clickup", "linear", "tickets"],
    context: "global",
    onSelect({ openScreen: open }) {
      open({ screenId: "tasks" });
    },
  });
  client.addCommandCenterItem({
    id: "open-projects",
    title: "Open Linear projects",
    icon: "FolderKanban",
    keywords: ["linear", "projects", "progress"],
    context: "global",
    onSelect({ openScreen: open }) {
      open({ screenId: "tasks", params: { view: "projects" } });
    },
  });
  client.addCommandCenterItem({
    id: "sync-tasks",
    title: "Sync tasks from ClickUp and Linear",
    icon: "RefreshCw",
    keywords: ["clickup", "linear", "tickets"],
    context: "global",
    async onSelect({ rpc, openScreen: open }) {
      await rpc(syncTasksRpc, {});
      open({ screenId: "tasks" });
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
