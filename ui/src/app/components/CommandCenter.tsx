import React, { useMemo, useState } from "react";
import { COMMAND_REGISTRY } from "../core/registry";
import { executeCommand } from "../core/commands";
import { useAppDispatch, useAppState } from "../state/store.tsx";

export function CommandCenter() {
  const { ui, commandHistory } = useAppState();
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(COMMAND_REGISTRY[0]);
  const [argsText, setArgsText] = useState("{}");
  const [error, setError] = useState("");
  const safeParse = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMAND_REGISTRY;
    return COMMAND_REGISTRY.filter((cmd) => cmd.name.includes(q) || cmd.title.toLowerCase().includes(q));
  }, [query]);

  const onRun = async () => {
    setError("");
    let args: Record<string, unknown> = {};
    try {
      if (argsText.trim()) args = JSON.parse(argsText);
    } catch (err) {
      setError("Args JSON invalid");
      return;
    }
    await executeCommand(dispatch, selected.name, args, { arming: selected.arming });
    dispatch({ type: "ui/commandCenter", open: false });
  };

  const grouped = useMemo(() => {
    const out: Record<string, typeof COMMAND_REGISTRY> = {};
    for (const cmd of filtered) {
      if (!out[cmd.category]) out[cmd.category] = [];
      out[cmd.category].push(cmd);
    }
    return out;
  }, [filtered]);

  const renderArgsForm = () => {
    if (selected.name === "providers.attach" || selected.name === "providers.revoke") {
      return (
        <div className="yx-command-center__form">
          <label>provider_id</label>
          <input
            type="text"
            placeholder="provider-id"
            onChange={(e) =>
              setArgsText(JSON.stringify({ id: e.target.value }, null, 2))
            }
          />
        </div>
      );
    }
    if (selected.name === "providers.discover") {
      return (
        <div className="yx-command-center__form">
          <label>endpoint</label>
          <input
            type="text"
            placeholder="http://localhost:8080"
            onChange={(e) =>
              setArgsText(JSON.stringify({ endpoint: e.target.value }, null, 2))
            }
          />
          <label>model</label>
          <input
            type="text"
            placeholder="gpt-4"
            onChange={(e) =>
              setArgsText(
                JSON.stringify(
                  { ...(safeParse(argsText || "{}") as any), model: e.target.value },
                  null,
                  2
                )
              )
            }
          />
        </div>
      );
    }
    if (selected.name === "chat.send") {
      return (
        <div className="yx-command-center__form">
          <label>text</label>
          <input
            type="text"
            placeholder="hello"
            onChange={(e) =>
              setArgsText(JSON.stringify({ text: e.target.value }, null, 2))
            }
          />
        </div>
      );
    }
    if (selected.name === "shell.exec") {
      return (
        <div className="yx-command-center__form">
          <label>cmd</label>
          <input
            type="text"
            placeholder="ls -la"
            onChange={(e) =>
              setArgsText(JSON.stringify({ cmd: e.target.value }, null, 2))
            }
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`yx-command-center ${ui.commandCenterOpen ? "yx-command-center--open" : ""}`}>
      <div className="yx-command-center__overlay" onClick={() => dispatch({ type: "ui/commandCenter", open: false })} />
      <div className="yx-command-center__panel">
        <header className="yx-command-center__header">
          <h3>Command Center</h3>
          <button type="button" onClick={() => dispatch({ type: "ui/commandCenter", open: false })}>
            Close
          </button>
        </header>
        <div className="yx-command-center__body">
          <div className="yx-command-center__list">
            <input
              className="yx-input"
              type="text"
              placeholder="Search commands"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="yx-command-center__group">
                <div className="yx-command-center__group-title">{category}</div>
                {items.map((cmd) => (
                  <button
                    key={cmd.name}
                    type="button"
                    className={`yx-palette__item ${selected.name === cmd.name ? "active" : ""}`}
                    onClick={() => {
                      setSelected(cmd);
                      setArgsText(cmd.sample_args || "{}");
                    }}
                  >
                    <div className="yx-palette__item-main">{cmd.title}</div>
                    <div className="yx-palette__item-desc">{cmd.description}</div>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="yx-command-center__preview">
            <h4>{selected.name}</h4>
            <p className="yx-muted">{selected.description}</p>
            {selected.arming ? <div className="yx-badge yx-badge--warn">ARMING REQUIRED</div> : null}
            {renderArgsForm()}
            <textarea
              className="yx-shell-output"
              style={{ width: "100%", minHeight: 120 }}
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
            />
            {error ? <div className="yx-error">{error}</div> : null}
            <button type="button" onClick={onRun} style={{ marginTop: 8 }}>
              Run
            </button>

            <div className="yx-command-center__history">
              <div className="yx-command-center__group-title">Recent Runs</div>
              {commandHistory.slice(0, 6).map((item) => (
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
