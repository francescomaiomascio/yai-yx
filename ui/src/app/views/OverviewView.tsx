import React from "react";
import React, { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { FeedList } from "../components/FeedList";
import { useAppDispatch, useAppState } from "../state/store.tsx";
import { executeCommand } from "../core/commands";
import { connectionBadge } from "../core/connection";

export function OverviewView() {
  const { connection, events, logs, commandHistory, providers } = useAppState();
  const dispatch = useAppDispatch();
  const badge = connectionBadge(connection);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [logFilter, setLogFilter] = useState<string>("all");

  const filteredEvents = useMemo(() => {
    if (eventFilter === "all") return events;
    return events.filter((evt) => evt.severity.toLowerCase() === eventFilter);
  }, [events, eventFilter]);
  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter((evt) => evt.severity.toLowerCase() === logFilter);
  }, [logs, logFilter]);

  const lastActivation = useMemo(() => {
    const hit = events.find((evt) => evt.topic.toLowerCase().includes("mind"));
    return hit ? new Date(hit.ts_ms).toLocaleTimeString() : "-";
  }, [events]);

  const runQuick = async (name: string, args: Record<string, unknown> = {}) => {
    const arming = name.startsWith("providers.") || name.startsWith("shell.");
    const res = await executeCommand(dispatch, name, args, { arming });
    dispatch({ type: "inspector/open", title: name, item: {
      trace_id: res.id,
      name,
      ts_ms: Date.now(),
      ok: res.ok,
      request: { id: res.id, ts_ms: Date.now(), name, args },
      response: res.ok ? res : undefined,
      error: res.ok ? undefined : res.error,
    }});
  };

  return (
    <div className="yx-overview">
      <div className="yx-health-strip">
        <div className="yx-health-card">
          <div className="yx-health-card__title">Connection</div>
          <div className="yx-health-card__value">{badge.text}</div>
          <div className="yx-health-card__meta">{connection.socket_path}</div>
        </div>
        <div className="yx-health-card">
          <div className="yx-health-card__title">Workspace</div>
          <div className="yx-health-card__value">{connection.selected_ws}</div>
          <div className="yx-health-card__meta">{connection.latency_ms ? `${connection.latency_ms}ms` : ""}</div>
        </div>
        <div className="yx-health-card">
          <div className="yx-health-card__title">Runtime</div>
          <div className="yx-health-card__value">{connection.resolved_mode}</div>
          <div className="yx-health-card__meta">daemon pid: {connection.connected ? "up" : "down"}</div>
        </div>
        <div className="yx-health-card">
          <div className="yx-health-card__title">Providers</div>
          <div className="yx-health-card__value">{providers.items.length}</div>
          <div className="yx-health-card__meta">last change: -</div>
        </div>
        <div className="yx-health-card">
          <div className="yx-health-card__title">Law</div>
          <div className="yx-health-card__value">0</div>
          <div className="yx-health-card__meta">violations</div>
        </div>
        <div className="yx-health-card">
          <div className="yx-health-card__title">Mind</div>
          <div className="yx-health-card__value">{lastActivation}</div>
          <div className="yx-health-card__meta">last activation</div>
        </div>
      </div>

      <div className="yx-overview-grid">
        <Card title="Events Stream" subtitle="Operational events">
          <div className="yx-toolbar">
            {["all", "info", "warn", "error"].map((tone) => (
              <button key={tone} type="button" onClick={() => setEventFilter(tone)}>
                {tone.toUpperCase()}
              </button>
            ))}
          </div>
          <FeedList
            items={filteredEvents.slice(0, 12)}
            onSelect={(evt) =>
              dispatch({
                type: "inspector/open",
                title: evt.topic,
                item: {
                  trace_id: evt.trace_id || `evt-${evt.ts_ms}`,
                  name: evt.topic,
                  ts_ms: evt.ts_ms,
                  ok: true,
                  request: { id: evt.trace_id || `evt-${evt.ts_ms}`, ts_ms: evt.ts_ms, name: evt.topic, args: {} },
                  response: { id: evt.trace_id || `evt-${evt.ts_ms}`, ts_ms: evt.ts_ms, name: evt.topic, ok: true, result: evt.payload },
                },
              })
            }
          />
        </Card>
        <Card title="Logs Stream" subtitle="Daemon logs">
          <div className="yx-toolbar">
            {["all", "info", "warn", "error"].map((tone) => (
              <button key={tone} type="button" onClick={() => setLogFilter(tone)}>
                {tone.toUpperCase()}
              </button>
            ))}
          </div>
          <FeedList
            items={filteredLogs.slice(0, 12)}
            onSelect={(evt) =>
              dispatch({
                type: "inspector/open",
                title: evt.topic,
                item: {
                  trace_id: evt.trace_id || `log-${evt.ts_ms}`,
                  name: evt.topic,
                  ts_ms: evt.ts_ms,
                  ok: true,
                  request: { id: evt.trace_id || `log-${evt.ts_ms}`, ts_ms: evt.ts_ms, name: evt.topic, args: {} },
                  response: { id: evt.trace_id || `log-${evt.ts_ms}`, ts_ms: evt.ts_ms, name: evt.topic, ok: true, result: evt.payload },
                },
              })
            }
          />
        </Card>
      </div>

      <Card title="Command History" subtitle="Recent command execution">
        <div className="yx-command-history">
          {commandHistory.length === 0 ? (
            <div className="yx-muted">No commands yet.</div>
          ) : (
            commandHistory.slice(0, 8).map((item) => (
              <button
                key={item.trace_id}
                type="button"
                className="yx-history-row"
                onClick={() => dispatch({ type: "inspector/open", title: item.name, item })}
              >
                <div>{item.name}</div>
                <div>{item.ok ? "OK" : "ERR"}</div>
                <div>{new Date(item.ts_ms).toLocaleTimeString()}</div>
                <div className="yx-muted">{item.trace_id}</div>
              </button>
            ))
          )}
        </div>
      </Card>

      <div className="yx-overview-footer-strip">
        <button type="button" onClick={() => runQuick("status")}>Status</button>
        <button type="button" onClick={() => runQuick("law.snapshot")}>Law Snapshot</button>
        <button type="button" onClick={() => runQuick("providers.discover")}>Providers Discover</button>
        <button type="button" onClick={() => runQuick("providers.list")}>Providers List</button>
        <button type="button" onClick={() => runQuick("shell.exec", { cmd: "tail -n 50 ~/.yai/run/dev/daemon.log" })}>Tail Logs</button>
      </div>
    </div>
  );
}
