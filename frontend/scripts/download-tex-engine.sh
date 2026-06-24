#!/usr/bin/env bash
# Fetch the large busytex WASM engine binaries into frontend/public/tex/.
# The small MIT JS glue (busytex_worker.js, busytex_pipeline.js) is committed;
# these big binaries are gitignored. Engine = upstream MIT busytex/busytex
# (TeX Live 2023). See LATEX_EDITOR_PLAN.md §0/§8.1.
#
# For production, host these on a CDN/object storage and set VITE_TEX_ENGINE_URL
# instead of serving them from public/.
set -euo pipefail

REPO="busytex/busytex"
REL="build_wasm_4499aa69fd3cf77ad86a47287d9a5193cf5ad993_7936974349_1"
DIR="$(cd "$(dirname "$0")/.." && pwd)/public/tex"
mkdir -p "$DIR"

echo "Downloading busytex engine binaries -> $DIR"
gh release download "$REL" --repo "$REPO" --dir "$DIR" --clobber \
  --pattern busytex.wasm \
  --pattern busytex.js \
  --pattern texlive-basic.data \
  --pattern texlive-basic.js

echo "Done."
