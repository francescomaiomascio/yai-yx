import React, { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { useAppDispatch, useAppState } from "../state/store.tsx";
import { executeCommand } from "../core/commands";
import type { ProviderItem } from "../state/types";

function normalizeLastSeen(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  // server: epoch seconds (tipico). Date vuole ms.
  return n < 10_000_000_000 ? n * 1000 : n;
}

function normalizeProviders(result: any): ProviderItem[] {
  const items = result?.items ?? result?.providers ?? result;
  if (!Array.isArray(items)) return [];
  return items.map((p: any) => ({
    id: String(p.id || p.provider_id || p.name || "unknown"),
    endpoint: p.endpoint ?? null,
    model: p.model ?? null,
    state: p.trust_state || p.state || null,
    last_seen: normalizeLastSeen(p.last_seen),
    last_error: p.last_error ?? null,
  }));
}

function requiresArming(name: string): boolean {
  // allineato al daemon: pair/attach/revoke/detach richiedono operator+arming
  return (
    name === "providers.pair" ||
    name === "providers.attach" ||
    name === "providers.revoke" ||
    name === "providers.detach"
  );
}

export function ProvidersView() {
  const { providers } = useAppState();
  const dispatch = useAppDispatch();

  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [providerId, setProviderId] = useState("");

  const discoverArgs = useMemo(() => {
    // se vuoti: manda stringa vuota, così server riceve Some("") e decide lui
    // (oppure cambia qui a null se vuoi “None”)
    return { endpoint: endpoint ?? "", model: model ?? "" };
  }, [endpoint, model]);

  async function refreshListAndStatus() {
    // best-effort: non far fallire la UI se status/list falliscono dopo un comando
    const list = await executeCommand(dispatch, "providers.list", {}, { arming: false }).catch(() => null);
    if (list?.ok) dispatch({ type: "providers/set", items: normalizeProviders(list.result) });

    const st = await executeCommand(dispatch, "providers.status", {}, { arming: false }).catch(() => null);
    if (st?.ok) {
      const active = (st.result as any)?.active ?? null;
      if (active) {
        dispatch({
          type: "providers/active",
          active: {
            id: String(active.id || active.provider_id || active.name || "unknown"),
            endpoint: active.endpoint ?? null,
            model: active.model ?? null,
            state: active.trust_state || active.state || null,
            last_seen: normalizeLastSeen(active.last_seen),
            last_error: active.last_error ?? null,
          },
        });
      } else {
        dispatch({ type: "providers/active", active: null });
      }
    }
  }

  async function run(name: string, args: Record<string, unknown> = {}) {
    const res = await executeCommand(dispatch, name, args, { arming: requiresArming(name) });

    if (!res.ok) {
      dispatch({ type: "providers/error", message: res.error?.message || "command failed" });
      return;
    }

    if (name === "providers.list" || name === "providers.discover") {
      dispatch({ type: "providers/set", items: normalizeProviders(res.result as any) });
      await refreshListAndStatus();
      return;
    }

    if (name === "providers.status") {
      const active = (res.result as any)?.active ?? null;
      if (active) {
        dispatch({
          type: "providers/active",
          active: {
            id: String(active.id || active.provider_id || active.name || "unknown"),
            endpoint: active.endpoint ?? null,
            model: active.model ?? null,
            state: active.trust_state || active.state || null,
            last_seen: normalizeLastSeen(active.last_seen),
            last_error: active.last_error ?? null,
          },
        });
      } else {
        dispatch({ type: "providers/active", active: null });
      }
      return;
    }

    // lifecycle mutations: dopo esecuzione aggiorna vista
    if (
      name === "providers.pair" ||
      name === "providers.attach" ||
      name === "providers.revoke" ||
      name === "providers.detach"
    ) {
      await refreshListAndStatus();
    }
  }

  return (
    <div className="yx-providers">
      <Card title="Providers" subtitle="Lifecycle and status">
        <div className="yx-providers__actions">
          <button type="button" onClick={() => run("providers.discover", discoverArgs)}>
            Discover
          </button>
          <button type="button" onClick={() => run("providers.list")}>List</button>
          <button type="button" onClick={() => run("providers.status")}>Status</button>
          <button type="button" onClick={() => run("providers.detach")}>Detach</button>
        </div>

        {providers.lastError ? <div className="yx-error">{providers.lastError}</div> : null}

        <div className="yx-table">
          <div className="yx-table__head yx-table__head--providers">
            <div>ID</div>
            <div>State</div>
            <div>Endpoint</div>
            <div>Model</div>
            <div>Last Seen</div>
            <div>Error</div>
          </div>

          {providers.items.length === 0 ? (
            <div className="yx-muted">No providers.</div>
          ) : (
            providers.items.map((p) => (
              <button
                key={p.id}
                type="button"
                className="yx-table__row yx-table__row--providers"
                onClick={() =>
                  dispatch({
                    type: "inspector/open",
                    title: `provider ${p.id}`,
                    item: {
                      trace_id: `provider-${p.id}`,
                      name: "providers.item",
                      ts_ms: Date.now(),
                      ok: true,
                      request: { id: `provider-${p.id}`, ts_ms: Date.now(), name: "providers.item", args: { id: p.id } },
                      response: { id: `provider-${p.id}`, ts_ms: Date.now(), name: "providers.item", ok: true, result: p },
                    },
                  })
                }
              >
                <div>{p.id}</div>
                <div>{p.state || "-"}</div>
                <div>{p.endpoint || "-"}</div>
                <div>{p.model || "-"}</div>
                <div>{p.last_seen ? new Date(p.last_seen).toLocaleTimeString() : "-"}</div>
                <div className="yx-muted">{p.last_error || "-"}</div>
              </button>
            ))
          )}
        </div>
      </Card>

      <Card title="Lifecycle" subtitle="Pair / attach / revoke">
        <div className="yx-input-grid">
          <input type="text" placeholder="endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
          <input type="text" placeholder="model" value={model} onChange={(e) => setModel(e.target.value)} />
          <input type="text" placeholder="provider id" value={providerId} onChange={(e) => setProviderId(e.target.value)} />
        </div>

        <div className="yx-providers__actions" style={{ marginTop: 8 }}>
          <button type="button" onClick={() => run("providers.pair", { id: providerId, endpoint, model })}>Pair</button>
          <button type="button" onClick={() => run("providers.attach", { id: providerId, model: model || null })}>Attach</button>
          <button type="button" onClick={() => run("providers.revoke", { id: providerId })}>Revoke</button>
        </div>
      </Card>

      <Card title="Active Provider" subtitle="Current attached provider">
        {providers.active ? (
          <div className="yx-table__row-static">
            <div>{providers.active.id}</div>
            <div>{providers.active.state || "-"}</div>
            <div>{providers.active.endpoint || "-"}</div>
            <div>{providers.active.model || "-"}</div>
          </div>
        ) : (
          <div className="yx-muted">No active provider.</div>
        )}
      </Card>
    </div>
  );
}
