#!/usr/bin/env bash
# Fetch the busytex WASM engine + TeX Live 2023 'basic' data bundle from the
# upstream MIT busytex/busytex GitHub releases (the "Wasm assets" release).
#
# License: busytex repo code (the .js glue) is MIT; the compiled busytex.wasm and
# the texlive-*.data bundles carry the respective TeX Live / LPPL (permissive)
# licenses. This is Path-1 clean for an MIT project. The TeXlyre TeX Live 2026
# rebuild is AGPL and is intentionally NOT used here. See ../../LATEX_EDITOR_PLAN.md §0.
set -euo pipefail

REPO="busytex/busytex"
REL="build_wasm_4499aa69fd3cf77ad86a47287d9a5193cf5ad993_7936974349_1"  # TeX Live 2023, emscripten 3.1.43
DIR="$(cd "$(dirname "$0")" && pwd)/vendor"
mkdir -p "$DIR"

echo "Downloading busytex WASM assets ($REL) -> $DIR"
gh release download "$REL" --repo "$REPO" --dir "$DIR" --clobber \
  --pattern busytex.wasm \
  --pattern busytex.js \
  --pattern busytex_pipeline.js \
  --pattern busytex_worker.js \
  --pattern texlive-basic.data \
  --pattern texlive-basic.js \
  --pattern texlive-basic.profile \
  --pattern texmf.cnf \
  --pattern updmap.cfg \
  --pattern dvipdfmx.cfg \
  --pattern versions.txt

echo "Done. TeX Live version:"
grep -i texlive "$DIR/versions.txt" | head -1
