import React from "react";
import { Card } from "../components/Card";
import { FeedList } from "../components/FeedList";
import { useAppDispatch, useAppState } from "../state/store.tsx";

export function EventsView() {
  const { events } = useAppState();
  const dispatch = useAppDispatch();
  return (
    <Card title="Events" subtitle="Daemon event stream">
      <FeedList
        items={events}
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
  );
}
