# YX Skin Pack

Imported selectively from legacy `yai-skin`.

Included:
- base css
- semantic tokens/themes
- generic components (buttons/cards/forms/modal)
- brand master icon and icon generator

Excluded by policy:
- IDE/workspace/editor/explorer/plugin-dock/terminal css
- interface layer css
- electron-specific icons

## Regenerate icons

```bash
cd ui/src/skin/icons
./generate-icons.sh
```

Generated files are written to `ui/public/icons`.
