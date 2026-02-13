import React from "react";
import { Badge } from "./Badge";
import { connectionBadge } from "../core/connection";
import type { ConnectionState } from "../state/types";

export function LeftRail({
  connection,
  runtimeMode,
  lastCommand,
  onCommandCenter,
  onClearFeeds,
  collapsed,
  onToggle,
}: {
  connection: ConnectionState;
  runtimeMode: string;
  lastCommand: string;
  onCommandCenter: () => void;
  onClearFeeds: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const badge = connectionBadge(connection);
  return (
    <aside className={`yx-rail ${collapsed ? "yx-rail--collapsed" : ""}`}>
      <div className="yx-rail__head">
        <button type="button" onClick={onToggle} aria-label="Toggle rail">
          {collapsed ? ">" : "<"}
        </button>
      </div>
      <div className="yx-rail__section">
        <div className="yx-rail__label">Connection</div>
        <Badge tone={badge.tone} text={badge.text} />
        <div className="yx-rail__meta">{connection.selected_ws}</div>
      </div>
      <div className="yx-rail__section">
        <div className="yx-rail__label">Runtime</div>
        <Badge tone="neutral" text={runtimeMode || "unknown"} />
      </div>
      <div className="yx-rail__section">
        <div className="yx-rail__label">Last Command</div>
        <div className="yx-rail__meta">{lastCommand || "-"}</div>
      </div>
      <div className="yx-rail__section">
        <button type="button" onClick={onCommandCenter}>
          Command Center
        </button>
        <button type="button" onClick={onClearFeeds}>
          Clear Feeds
        </button>
      </div>
    </aside>
  );
}
