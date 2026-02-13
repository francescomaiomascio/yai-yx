import React from "react";
import { Card } from "../components/Card";
import { FeedList } from "../components/FeedList";
import { useAppDispatch, useAppState } from "../state/store.tsx";

export function LogsView() {
  const { logs } = useAppState();
  const dispatch = useAppDispatch();
  return (
    <Card title="Logs" subtitle="Filtered log events">
      <FeedList
        items={logs}
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
  );
}
