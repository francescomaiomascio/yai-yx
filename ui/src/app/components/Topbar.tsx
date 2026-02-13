import React from "react";
import { connectionBadge } from "../core/connection";
import type { ConnectionState, WorkspacesState } from "../state/types";
import { Badge } from "./Badge";

export function Topbar({
  connection,
  workspaces,
  activeRoute,
  onRoute,
  onWorkspaceChange,
  onReconnect,
}: {
  connection: ConnectionState;
  workspaces: WorkspacesState;
  activeRoute: string;
  onRoute: (id: string) => void;
  onWorkspaceChange: (ws: string) => void;
  onReconnect: () => void;
}) {
  const badge = connectionBadge(connection);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "providers", label: "Providers" },
    { id: "logs", label: "Logs" },
    { id: "events", label: "Events" },
    { id: "law", label: "Law" },
    { id: "mind", label: "Mind" },
    { id: "chat", label: "Chat" },
    { id: "shell", label: "Shell" },
  ];

  return (
    <header className="yx-topbar">
      <div className="yx-topbar__left">
        <Badge tone={badge.tone} text={badge.text} />
        <nav className="yx-topbar__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeRoute === tab.id ? "active" : ""}
              onClick={() => onRoute(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="yx-topbar__right">
        <select value={workspaces.selected_ws} onChange={(e) => onWorkspaceChange(e.target.value)}>
          {workspaces.items.map((ws) => (
            <option key={ws.ws} value={ws.ws}>
              {ws.ws} {ws.alive ? "●" : ""}
            </option>
          ))}
        </select>
        <button type="button" onClick={onReconnect}>
          Refresh
        </button>
        <span className="yx-latency">{connection.latency_ms ? `${connection.latency_ms}ms` : ""}</span>
        <span className="yx-socket" title={connection.socket_path}>
          {connection.socket_path}
        </span>
      </div>
    </header>
  );
}
