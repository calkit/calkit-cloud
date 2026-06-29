#!/usr/bin/env bash
# Scaffold: build a busytex WASM engine patched with the Calkit remote-fetch
# kpathsea hook. Produces build/wasm/busytex.{js,wasm} that fetches missing TeX
# files on demand from a texmf proxy (set Module.calkitTexmfEndpoint at init).
#
# STATUS: scaffold. The patch + glue + Makefile edits below are validated
# (apply_patch.py runs against the real TeX Live 2023 kpathsea), but a full
# build has NOT been run here — it needs the busytex toolchain (Emscripten,
# cmake, gperf, p7zip) and a multi-hour TeX Live compile. Steps marked CONFIRM
# need a check against busytex's current Makefile target graph on first run.
#
# Deps (from busytex README): wget cmake gperf p7zip-full emscripten python3
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-/tmp/busytex-remote-build}"
mkdir -p "$WORK"
cd "$WORK"

# 1. busytex source (MIT). TeX Live 2023 is downloaded by its Makefile.
[ -d busytex ] || git clone --depth 1 https://github.com/busytex/busytex
cd busytex

# 2. Extract the TeX Live source so kpathsea can be patched before it compiles.
#    CONFIRM the exact target: busytex downloads URL_texlive and unpacks under
#    source/texlive. Inspect `make -pn` for the unpack target if this differs.
make source/texlive 2>/dev/null || {
  echo ">> CONFIRM: 'make source/texlive' is not the unpack target on this"
  echo ">> busytex revision. Find it with: make -pn | grep texlive | head"
  exit 2
}

# 3. Patch kpathsea's public find-file entry point (idempotent).
python3 "$HERE/apply_patch.py" source/texlive/texk/kpathsea/tex-file.c

# 4. Compile the EM_JS hook into the engine (simplest: #include into busytex.c).
cp "$HERE/remote_fetch.c" .
grep -q 'remote_fetch.c' busytex.c || printf '\n#include "remote_fetch.c"\n' >> busytex.c

# 5. Export the runtime helpers the hook needs (FS is already exported).
python3 - <<'PY'
mk = open("Makefile").read()
mk = mk.replace(
    '-sEXPORTED_FUNCTIONS=\'["_main", "_flush_streams"]\'',
    '-sEXPORTED_FUNCTIONS=\'["_main", "_flush_streams", "_malloc"]\'',
)
mk = mk.replace(
    '-sEXPORTED_RUNTIME_METHODS=\'["callMain", "FS", "ENV", "LZ4", "PATH"]\'',
    '-sEXPORTED_RUNTIME_METHODS=\'["callMain", "FS", "ENV", "LZ4", "PATH", '
    '"stringToUTF8", "lengthBytesUTF8", "UTF8ToString"]\'',
)
open("Makefile", "w").write(mk)
print("Makefile: exports extended for the remote-fetch hook")
PY

# 6. Build the wasm engine (long — compiles TeX Live).
make build/wasm/busytex.js

echo "Done. Engine: $WORK/busytex/build/wasm/busytex.{js,wasm}"
echo "Wire-up: set Module.calkitTexmfEndpoint to the texmf proxy before init;"
echo "no iterative loop needed — missing files resolve in a single compile."
