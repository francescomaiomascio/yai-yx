# UI Law Mapping

UI actions are projections of control-plane capabilities.

## State -> Token/Theme Mapping

- preboot:
  - background: `--surface-bg`
  - text: `--text-muted`
  - accent: `--state-info`
- running:
  - background: `--surface-bg`
  - panel: `--surface-panel`
  - text: `--text-primary`
  - positive status: `--state-ok`
- degraded:
  - warning emphasis: `--state-warn`
  - keep layout stable, increase alert density only
- lockdown:
  - danger emphasis: `--state-deny`
  - high contrast banner mandatory
  - destructive and shell actions visually disabled unless capability+arming granted
- halted:
  - muted UI with critical marker (`--state-deny`)
  - actions reduced to diagnostics/recovery path

## Lockdown UI Rules

- Show persistent lockdown banner.
- Disable PTY open and privileged actions by default.
- Keep telemetry/logs readable; no hidden state transitions.
