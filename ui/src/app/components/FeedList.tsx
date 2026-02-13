import React from "react";
import type { EventItem } from "../state/types";
import { Badge } from "./Badge";

function toneFromSeverity(sev: string): "ok" | "warn" | "deny" | "info" | "neutral" {
  const s = sev.toLowerCase();
  if (s === "error" || s === "fatal") return "deny";
  if (s === "warn" || s === "warning") return "warn";
  if (s === "info") return "info";
  return "neutral";
}

export function FeedList({ items, onSelect }: { items: EventItem[]; onSelect?: (item: EventItem) => void }) {
  if (!items.length) return <div className="yx-muted">No events yet.</div>;
  return (
    <div className="yx-feed">
      {items.map((item, idx) => (
        <button
          key={`${item.ts_ms}-${idx}`}
          type="button"
          className="yx-feed__row"
          onClick={() => onSelect?.(item)}
        >
          <div className="yx-feed__time">{new Date(item.ts_ms).toLocaleTimeString()}</div>
          <div>{item.topic}</div>
          <Badge tone={toneFromSeverity(item.severity)} text={item.severity.toUpperCase()} />
          <div className="yx-feed__summary">
            {typeof item.payload === "string" ? item.payload : JSON.stringify(item.payload)}
          </div>
        </button>
      ))}
    </div>
  );
}
