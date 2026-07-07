#!/usr/bin/env bash
# Fetch the busytex WASM engine + TeX Live bundles into frontend/public/tex/.
# These are large and git-ignored; the small MIT glue (busytex_worker.js,
# busytex_pipeline.js) IS committed. Run in the Docker build (before
# `npm run build`) so a fresh checkout — CI/production, where git-ignored files
# are absent — still bundles the engine into dist/. See frontend/Dockerfile.
#
# Uses curl only (no gh/auth) so it works inside the build container against
# PUBLIC release assets. Override the engine source with TEX_ENGINE_REPO /
# TEX_ENGINE_TAG if you host it elsewhere.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/public/tex"
mkdir -p "$DIR"

# Patched engine (busytex.{js,wasm}): our remote-texmf-fetch + on-demand font
# generation hooks. Hosted separately (NOT calkit-cloud, whose releases trigger
# a production deploy). See spikes/busytex-remote-fetch.
ENGINE_REPO="${TEX_ENGINE_REPO:-calkit/busytex-engine}"
ENGINE_TAG="${TEX_ENGINE_TAG:-v1}"
ENGINE_BASE="https://github.com/${ENGINE_REPO}/releases/download/${ENGINE_TAG}"

# Stock TeX Live filesystem bundles (unpatched) — upstream busytex release. The
# .data are engine-agnostic TeX Live 2023 data, compatible with our build.
DATA_REPO="busytex/busytex"
DATA_TAG="build_wasm_4499aa69fd3cf77ad86a47287d9a5193cf5ad993_7936974349_1"
DATA_BASE="https://github.com/${DATA_REPO}/releases/download/${DATA_TAG}"

fetch() { echo "  -> $2"; curl -fSL --retry 3 --retry-delay 2 -o "$DIR/$2" "$1/$2"; }

echo "Patched engine  <- ${ENGINE_REPO}@${ENGINE_TAG}"
fetch "$ENGINE_BASE" busytex.js
fetch "$ENGINE_BASE" busytex.wasm

echo "TeX Live bundles <- ${DATA_REPO}@${DATA_TAG}"
for f in \
  texlive-basic.data texlive-basic.js \
  ubuntu-texlive-latex-base.data ubuntu-texlive-latex-base.js \
  ubuntu-texlive-latex-recommended.data ubuntu-texlive-latex-recommended.js \
  ubuntu-texlive-latex-extra.data ubuntu-texlive-latex-extra.js \
  ubuntu-texlive-science.data ubuntu-texlive-science.js \
  ubuntu-texlive-fonts-recommended.data ubuntu-texlive-fonts-recommended.js
do
  fetch "$DATA_BASE" "$f"
done

echo "Done -> $DIR"
