#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
MASTER="$ROOT/master/yai.png"
OUT="$ROOT/../../../public/icons"
PNG_OUT="$OUT/png"
FAVICON_OUT="$OUT/favicon"
SIZES=(1024 512 256 128 64 48 32 16)

mkdir -p "$PNG_OUT" "$FAVICON_OUT"

echo "Generating YX PNG sizes..."
for size in "${SIZES[@]}"; do
  magick "$MASTER" -resize "${size}x${size}" "$PNG_OUT/${size}.png"
done

echo "Generating YX favicons..."
cp "$PNG_OUT/32.png" "$FAVICON_OUT/favicon-32.png"
cp "$PNG_OUT/16.png" "$FAVICON_OUT/favicon-16.png"
magick \
  "$PNG_OUT/16.png" \
  "$PNG_OUT/32.png" \
  "$PNG_OUT/48.png" \
  "$FAVICON_OUT/favicon.ico"

echo "Done: $OUT"
