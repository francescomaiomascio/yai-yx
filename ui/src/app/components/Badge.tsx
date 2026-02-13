import React from "react";

export function Badge({ tone, text }: { tone: "ok" | "warn" | "deny" | "info" | "neutral"; text: string }) {
  const className = `yx-badge yx-badge--${tone}`;
  return <span className={className}>{text}</span>;
}
