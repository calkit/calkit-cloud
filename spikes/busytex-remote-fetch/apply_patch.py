#!/usr/bin/env python3
"""Patch kpathsea's tex-file.c with the Calkit remote-fetch indirection.

Two edits, both idempotent:

 1. In kpathsea_find_file(): on a local miss (ret == NULL), call
    kpse_remote_fetch(). This is the single function TeX uses to locate
    .tex/.sty/.cls/etc., so it covers the on-demand case in one compile.

 2. Append a PURE-C definition of kpse_remote_fetch that just delegates through
    a function pointer (kpse_remote_fetch_hook, default NULL). No EM_JS here.

Why pure C in kpathsea: EM_JS makes a symbol a JS import, and busytex builds
several standalone applet executables (kpsewhich, bibtex8, ...) whose link steps
reject a JS-import symbol pulled in via libkpathsea. Keeping kpathsea pure C
means kpse_remote_fetch is a real, defined wasm symbol everywhere; the actual
browser fetch (EM_JS) lives in busytex.c (remote_fetch.c) and is installed into
the hook pointer only in the engine. See README.md.

More robust than a context diff: matches the function and edits it, so it
survives line drift across TeX Live point releases.

Usage: apply_patch.py path/to/texk/kpathsea/tex-file.c
"""
import sys

FUNC_SIG = "kpathsea_find_file (kpathsea kpse, const_string name,"
OLD = "  string ret = *ret_list;\n  free (ret_list);\n  return ret;\n}"
NEW = (
    "  string ret = *ret_list;\n"
    "  free (ret_list);\n"
    "  if (ret == NULL)\n"
    "    ret = kpse_remote_fetch (name, format);\n"
    "  return ret;\n}"
)
# Forward declaration, inserted before the function's return-type line so the
# call above compiles.
DECL = (
    "/* Calkit: remote-fetch fallback; defined at end of file (indirection) and\n"
    "   installed by the engine (remote_fetch.c -> busytex.c). */\n"
    "extern string kpse_remote_fetch (const_string name,\n"
    "                                 kpse_file_format_type format);\n\n"
)
# Pure-C definition appended at end of file: delegate through a hook pointer so
# every binary linking libkpathsea resolves the symbol; the browser fetch is
# installed into the pointer by the engine only.
DEFN = """
/* Calkit: remote-fetch indirection (see spikes/busytex-remote-fetch, MIT).
   kpathsea stays pure C here so every binary that links libkpathsea.a — the
   standalone applets (kpsewhich, bibtex8, ...) AND the busytex engine — resolves
   kpse_remote_fetch as a real, defined wasm symbol. The actual browser fetch is
   an EM_JS function in busytex.c, installed into this hook pointer at engine
   startup; when the pointer is NULL (any standalone applet) the call is a
   harmless no-op that preserves stock kpathsea behaviour. */
char *(*kpse_remote_fetch_hook) (const char *name, int format) = 0;

string
kpse_remote_fetch (const_string name, kpse_file_format_type format)
{
  if (kpse_remote_fetch_hook == 0)
    return 0;
  return kpse_remote_fetch_hook ((const char *) name, (int) format);
}
"""


def main(path: str) -> int:
    src = open(path).read()
    if "kpse_remote_fetch" in src:
        print(f"{path}: already patched")
        return 0
    if FUNC_SIG not in src or OLD not in src:
        print(f"ERROR: could not locate kpathsea_find_file in {path}", file=sys.stderr)
        return 1
    marker = "\nstring\n" + FUNC_SIG
    src = src.replace(marker, "\n" + DECL + "string\n" + FUNC_SIG, 1)
    src = src.replace(OLD, NEW, 1)
    src = src.rstrip("\n") + "\n" + DEFN
    open(path, "w").write(src)
    print(f"{path}: patched (call + pure-C indirection)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
