#!/usr/bin/env bash
# Build a busytex WASM engine patched with the Calkit remote-fetch kpathsea hook.
# Produces build/wasm/busytex.{js,wasm} that fetches missing TeX files on demand
# from a texmf proxy (set Module.calkitTexmfEndpoint before init).
#
# STATUS: RAN GREEN. This is the exact sequence that produced a working
# busytex.js (~297 KB) + busytex.wasm (~30 MB) with our hook embedded, under
# emscripten/emsdk:3.1.43 (amd64). Design: kpathsea stays pure C with a NULL
# function pointer (apply_patch.py); the EM_JS browser fetch lives only in
# busytex.c (remote_fetch.c) and is installed into that pointer at engine
# startup — so every standalone applet (kpsewhich, bibtex8, ...) links cleanly.
#
# Toolchain: run inside `emscripten/emsdk:3.1.43`. Extra apt deps below.
#   docker run --rm --platform linux/amd64 -v "$PWD:/scaffold:ro" -v /tmp/bt:/work \
#     emscripten/emsdk:3.1.43 bash -c 'SCAFFOLD=/scaffold /scaffold/build.sh /work'
set -euo pipefail
HERE="${SCAFFOLD:-$(cd "$(dirname "$0")" && pwd)}"
WORK="${1:-/tmp/busytex-remote-build}"
# Pinned busytex native-binary release (kpathsea/web2c helpers used during the
# WASM build). Matches the tree this recipe was validated against.
NATIVE="build_native_ff0318af379bd80fb72b9b928d4744b5d9c9077d_12853073565_1"

mkdir -p "$WORK"; cd "$WORK"

# 0. Build deps (Debian/emsdk image). `file` is needed by make download-native.
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq gperf p7zip-full icu-devtools wget git python3 ca-certificates file >/dev/null
fi

# 1. busytex source (MIT). TeX Live 2023 is downloaded by its Makefile.
[ -d busytex ] || git clone --depth 1 https://github.com/busytex/busytex
cd busytex

# 2. Prebuilt native helpers (ctangle/otangle/web2c/...), then unpack + prep the
#    TeX Live source tree so kpathsea can be patched before it compiles.
echo "=== [1/4] download native binaries ==="
make URLRELEASE="https://github.com/busytex/busytex/releases/download/$NATIVE" download-native
echo "=== [2/4] fetch + prepare TeX Live source ==="
make source/texlive.txt build/versions.txt

# 3. Patch kpathsea (pure-C indirection: call site + hook-pointer delegator).
echo "=== [3/4] apply Calkit patch + engine hook ==="
python3 "$HERE/apply_patch.py" source/texlive/texk/kpathsea/tex-file.c

# 4. Append the EM_JS fetch + constructor to busytex.c (engine-only TU).
grep -q 'calkit_remote_fetch_js' busytex.c || { printf '\n'; cat "$HERE/remote_fetch.c"; } >> busytex.c

# 5. Export the runtime helpers the EM_JS hook needs (FS is already exported).
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

# 6. Build the wasm engine (long — compiles TeX Live). Redirect to a FILE:
#    make floods stdout, and piping it through docker logs can break the pipe
#    ('make: write error: stdout') and abort an otherwise-fine build.
echo "=== [4/4] make wasm (log: $WORK/busytex/build-wasm.log) ==="
make MAKEFLAGS=-j4 wasm > build-wasm.log 2>&1

ls -la build/wasm/busytex.js build/wasm/busytex.wasm
echo "Done. Engine: $WORK/busytex/build/wasm/busytex.{js,wasm}"
echo "Wire-up: set Module.calkitTexmfEndpoint to the texmf proxy before init;"
echo "no iterative loop needed — missing files resolve in a single compile."
