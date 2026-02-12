import { Card } from "../components/Card.js";

export function LawView(state) {
  return Card({
    title: "Law",
    subtitle: "Snapshot and violations",
    body: `
      <div class="yx-kv"><b>Violations:</b> ${state.health.law.violations}</div>
      <div class="yx-kv"><b>Last violation:</b> ${state.health.law.lastViolationTs ? new Date(state.health.law.lastViolationTs).toLocaleString() : "none"}</div>
      <p class="yx-muted">Use command palette (Ctrl+K) for law.snapshot.</p>
    `,
  });
}
