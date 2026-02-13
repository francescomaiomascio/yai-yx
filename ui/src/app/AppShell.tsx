import React, { useCallback, useEffect } from "react";
import { Topbar } from "./components/Topbar";
import { LeftRail } from "./components/LeftRail";
import { CommandCenter } from "./components/CommandCenter";
import { InspectorDrawer } from "./components/InspectorDrawer";
import { useAppDispatch, useAppState } from "./state/store.tsx";
import { selectWorkspace, getConnectionState, ping } from "./api/bridge";
import { OverviewView } from "./views/OverviewView";
import { EventsView } from "./views/EventsView";
import { LogsView } from "./views/LogsView";
import { LawView } from "./views/LawView";
import { ProvidersView } from "./views/ProvidersView";
import { MindView } from "./views/MindView";
import { ChatView } from "./views/ChatView";
import { ShellView } from "./views/ShellView";

export function AppShell() {
  const state = useAppState();
  const { ui, connection, workspaces } = state;
  const dispatch = useAppDispatch();

  const refreshConnection = useCallback(async () => {
    const [state, pong] = await Promise.all([getConnectionState(), ping()]);
    dispatch({
      type: "connection/set",
      payload: {
        ...state,
        connected: Boolean(pong?.ok),
        socket_path: pong?.socket_path || state.socket_path,
        latency_ms: pong?.latency_ms ?? null,
        last_ok_ts_ms: pong?.ok ? Date.now() : state.last_ok_ts_ms,
      },
    });
  }, [dispatch]);

  const handleWorkspaceChange = async (ws: string) => {
    await selectWorkspace(ws);
    dispatch({ type: "workspaces/set", selected_ws: ws });
    await refreshConnection();
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch({ type: "ui/commandCenter", open: false });
        dispatch({ type: "inspector/close" });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dispatch({ type: "ui/commandCenter", open: true });
      }
      if (event.ctrlKey || event.metaKey) {
        const num = Number(event.key);
        if (!Number.isNaN(num) && num >= 1 && num <= 8) {
          event.preventDefault();
          const routes = ["overview", "providers", "logs", "events", "law", "mind", "chat", "shell"];
          dispatch({ type: "route/set", route: routes[num - 1] });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);

  const route = ui.route;
  let content: React.ReactNode = null;
  switch (route) {
    case "events":
      content = <EventsView />;
      break;
    case "logs":
      content = <LogsView />;
      break;
    case "law":
      content = <LawView />;
      break;
    case "mind":
      content = <MindView />;
      break;
    case "providers":
      content = <ProvidersView />;
      break;
    case "chat":
      content = <ChatView />;
      break;
    case "shell":
      content = <ShellView />;
      break;
    default:
      content = <OverviewView />;
      break;
  }

  return (
    <div className={`yx-shell ${ui.navCollapsed ? "yx-shell--nav-collapsed" : ""}`}>
      <Topbar
        connection={connection}
        workspaces={workspaces}
        activeRoute={ui.route}
        onRoute={(id) => dispatch({ type: "route/set", route: id })}
        onWorkspaceChange={handleWorkspaceChange}
        onReconnect={refreshConnection}
      />
      <div className="yx-main">
        <LeftRail
          connection={connection}
          runtimeMode={connection.resolved_mode}
          lastCommand={state.commandHistory[0]?.name || ""}
          onCommandCenter={() => dispatch({ type: "ui/commandCenter", open: true })}
          onClearFeeds={() => dispatch({ type: "feeds/clear" })}
          collapsed={ui.navCollapsed}
          onToggle={() => dispatch({ type: "ui/nav", collapsed: !ui.navCollapsed })}
        />
        <main className="yx-content">{content}</main>
      </div>
      <CommandCenter />
      <InspectorDrawer />
    </div>
  );
}
