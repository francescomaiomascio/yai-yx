import React from "react";
import { useAppDispatch, useAppState } from "../state/store.tsx";

export function InspectorDrawer() {
  const { ui, inspector } = useAppState();
  const dispatch = useAppDispatch();
  const item = inspector.item;

  return (
    <aside className={`yx-drawer ${ui.inspectorOpen ? "yx-drawer--open" : ""}`}>
      <div className="yx-drawer__header">
        <h3>Inspector</h3>
        <button type="button" onClick={() => dispatch({ type: "inspector/close" })}>
          Close
        </button>
      </div>
      {item ? (
        <div className="yx-drawer__section">
          <dl>
            <dt>Title</dt>
            <dd>{inspector.title}</dd>
            <dt>Trace</dt>
            <dd>{item.trace_id}</dd>
            <dt>Command</dt>
            <dd>{item.name}</dd>
            <dt>OK</dt>
            <dd>{item.ok ? "true" : "false"}</dd>
          </dl>
          <h4>Request</h4>
          <pre>{JSON.stringify(item.request, null, 2)}</pre>
          <h4>Response</h4>
          <pre>{JSON.stringify(item.response ?? item.error ?? {}, null, 2)}</pre>
        </div>
      ) : (
        <div className="yx-drawer__section yx-muted">No selection.</div>
      )}
    </aside>
  );
}
