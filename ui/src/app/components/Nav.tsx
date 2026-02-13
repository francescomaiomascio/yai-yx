import React from "react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "logs", label: "Logs" },
  { id: "law", label: "Law" },
  { id: "providers", label: "Providers" },
  { id: "chat", label: "Chat" },
  { id: "shell", label: "Shell" },
];

export function Nav({
  active,
  collapsed,
  onSelect,
  onToggle,
}: {
  active: string;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onToggle: () => void;
}) {
  return (
    <aside className="yx-sidebar">
      <div className="yx-sidebar__head">
        <h1>YAI</h1>
        <button type="button" onClick={onToggle} aria-label="Toggle navigation">
          {collapsed ? ">" : "<"}
        </button>
      </div>
      <nav className="yx-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? "active" : ""}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export { NAV_ITEMS };
