# YX (YAI Experience)

Single Sovereign Interface for YAI.

## Scope

YX is the only graphical interface for YAI control-plane operations.
It connects to `yai` over UDS NDJSON protocol v1.

## Modes

- `real`: connect to UDS socket (`YX_SOCK`)
- `mock`: local simulator
- `auto` (default): fallback to mock when socket is unavailable

## DO NOTs

- no editor
- no file explorer
- no plugin system
- no git panel
- no import of legacy `yai-studio` UI code

## Skin Pack (Imported)

YX uses a local skin pack under `ui/src/skin` imported from legacy `yai-skin`.

Regenerate icons:

```bash
cd ui/src/skin/icons
./generate-icons.sh
```

Output is written to `ui/public/icons`.
