#!/usr/bin/env bash
# Fetch the stock TeX Live filesystem bundles into frontend/public/tex/.
#
# These are large (~190 MB) and carry the various per-package TeX Live licenses,
# so they are git-ignored and pulled from the upstream busytex release at build
# time (see frontend/Dockerfile) rather than vendored. Our patched engine
# (busytex.{js,wasm}, MIT) IS committed — see public/tex/LICENSE-busytex — so it
# is not fetched here.
#
# Uses curl only (no gh/auth) against PUBLIC release assets, and skips files that
# already exist so local builds (which have the bundles on disk) are a no-op.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/public/tex"
mkdir -p "$DIR"

# Upstream busytex release. The .data are engine-agnostic TeX Live 2023 data,
# compatible with our patched build.
DATA_REPO="busytex/busytex"
DATA_TAG="build_wasm_4499aa69fd3cf77ad86a47287d9a5193cf5ad993_7936974349_1"
DATA_BASE="https://github.com/${DATA_REPO}/releases/download/${DATA_TAG}"

fetch() {
  if [ -s "$DIR/$1" ]; then echo "  = $1 (present)"; return 0; fi
  echo "  -> $1"
  curl -fSL --retry 3 --retry-delay 2 -o "$DIR/$1" "$DATA_BASE/$1"
}

echo "TeX Live bundles <- ${DATA_REPO}@${DATA_TAG}"
for f in \
  texlive-basic.data texlive-basic.js \
  ubuntu-texlive-latex-base.data ubuntu-texlive-latex-base.js \
  ubuntu-texlive-latex-recommended.data ubuntu-texlive-latex-recommended.js \
  ubuntu-texlive-latex-extra.data ubuntu-texlive-latex-extra.js \
  ubuntu-texlive-science.data ubuntu-texlive-science.js \
  ubuntu-texlive-fonts-recommended.data ubuntu-texlive-fonts-recommended.js
do
  fetch "$f"
done

echo "Done -> $DIR"
