import React, { useMemo } from "react";
import { Card } from "../components/Card";
import { useAppDispatch, useAppState } from "../state/store.tsx";
import type { EventItem } from "../state/types";

function isActivation(evt: EventItem): boolean {
  const topic = evt.topic.toLowerCase();
  return topic.includes("mind") || topic.includes("activation") || topic.includes("graph");
}

export function MindView() {
  const { events } = useAppState();
  const dispatch = useAppDispatch();

  const activations = useMemo(() => events.filter(isActivation), [events]);
  const recentNodes = useMemo(() => {
    const seen = new Map<string, EventItem>();
    for (const evt of activations) {
      const payload = evt.payload as any;
      const id = String(payload?.id || payload?.node_id || payload?.node || payload?.entity || "unknown");
      if (!seen.has(id)) {
        seen.set(id, evt);
      }
      if (seen.size >= 20) break;
    }
    return Array.from(seen.entries());
  }, [activations]);

  return (
    <div className="yx-mind-view">
      <Card title="Activation Stream" subtitle="Recent mind activations">
        {activations.length === 0 ? (
          <div className="yx-muted">No activations yet.</div>
        ) : (
          <div className="yx-feed">
            {activations.slice(0, 20).map((evt, idx) => (
              <button
                key={`${evt.ts_ms}-${idx}`}
                type="button"
                className="yx-feed__row"
                onClick={() =>
                  dispatch({
                    type: "inspector/open",
                    title: evt.topic,
                    item: {
                      trace_id: evt.trace_id || `mind-${evt.ts_ms}`,
                      name: evt.topic,
                      ts_ms: evt.ts_ms,
                      ok: true,
                      request: {
                        id: evt.trace_id || `mind-${evt.ts_ms}`,
                        ts_ms: evt.ts_ms,
                        name: evt.topic,
                        args: (evt.payload as Record<string, unknown>) || {},
                      },
                      response: {
                        id: evt.trace_id || `mind-${evt.ts_ms}`,
                        ts_ms: evt.ts_ms,
                        name: evt.topic,
                        ok: true,
                        result: evt.payload,
                      },
                    },
                  })
                }
              >
                <div className="yx-feed__time">{new Date(evt.ts_ms).toLocaleTimeString()}</div>
                <div>{evt.topic}</div>
                <div className="yx-feed__summary">
                  {typeof evt.payload === "string" ? evt.payload : JSON.stringify(evt.payload)}
                </div>
                <div className="yx-feed__summary">{evt.trace_id}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent Nodes" subtitle="Deduped nodes seen recently">
        {recentNodes.length === 0 ? (
          <div className="yx-muted">No nodes yet.</div>
        ) : (
          <div className="yx-table">
            <div className="yx-table__head">
              <div>Node ID</div>
              <div>Topic</div>
              <div>Time</div>
              <div>Trace</div>
            </div>
            {recentNodes.map(([id, evt]) => (
              <div key={id} className="yx-table__row">
                <div>{id}</div>
                <div>{evt.topic}</div>
                <div>{new Date(evt.ts_ms).toLocaleTimeString()}</div>
                <div className="yx-muted">{evt.trace_id || "-"}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Graph Renderer (planned)" subtitle="Coming after multi-tenant runtime">
        <div className="yx-muted">Graph rendering will be added once ws_id routing is enforced end-to-end.</div>
      </Card>
    </div>
  );
}
