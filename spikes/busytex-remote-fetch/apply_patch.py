#!/usr/bin/env python3
"""Patch kpathsea with the Calkit remote-fetch indirection (tex-file.c + tex-make.c).

All edits idempotent. tex-file.c (file lookups):

 1. In kpathsea_find_file(): on a local miss (ret == NULL), call
    kpse_remote_fetch(). This is the single function TeX uses to locate
    .tex/.sty/.cls/etc., so it covers the on-demand case in one compile.

 2. Append a PURE-C definition of kpse_remote_fetch that just delegates through
    a function pointer (kpse_remote_fetch_hook, default NULL). No EM_JS here.

tex-make.c (font/metric generation):

 3. In kpathsea_make_tex(): before forking a mktex* script (impossible under
    WASM — no fork()), fetch the file it WOULD generate (e.g. tctt1000.600pk)
    from the remote proxy, which runs a full TeX Live and can generate it.
    PK/GF glyph lookups never hit kpathsea_find_file, so edit (1) can't cover
    them; this does.

Why pure C in kpathsea: EM_JS makes a symbol a JS import, and busytex builds
several standalone applet executables (kpsewhich, bibtex8, ...) whose link steps
reject a JS-import symbol pulled in via libkpathsea. Keeping kpathsea pure C
means kpse_remote_fetch is a real, defined wasm symbol everywhere; the actual
browser fetch (EM_JS) lives in busytex.c (remote_fetch.c) and is installed into
the hook pointer only in the engine. See README.md.

More robust than a context diff: matches the functions and edits them, so it
survives line drift across TeX Live point releases.

Usage: apply_patch.py path/to/texk/kpathsea    (dir, or the tex-file.c inside it)
"""
import os
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


# --- tex-make.c: intercept font/metric generation before it forks ------------
MK_INC_OLD = "#include <kpathsea/variable.h>\n"
MK_INC_NEW = "#include <kpathsea/variable.h>\n#include <kpathsea/concatn.h>\n"
MK_OLD = (
    "    args[argnum++] = xstrdup(base);\n"
    "    args[argnum] = NULL;\n\n"
    "    ret = maketex (kpse, format, args);"
)
MK_NEW = (
    "    args[argnum++] = xstrdup(base);\n"
    "    args[argnum] = NULL;\n\n"
    "    /* Calkit: mktex* scripts fork(), which WASM can't do, so the engine's\n"
    "       on-the-fly font/metric generation fails fatally. Before forking, try to\n"
    "       fetch the file the script WOULD generate from the remote texmf proxy (a\n"
    "       full TeX Live that can generate it). Reuses the kpse_remote_fetch hook\n"
    "       the engine installs; a NULL hook (standalone applets) just skips this. */\n"
    "    {\n"
    "      extern string kpse_remote_fetch (const_string name,\n"
    "                                       kpse_file_format_type format);\n"
    "      string ck_target = NULL;\n"
    "      if (format == kpse_pk_format || format == kpse_gf_format) {\n"
    "        string ck_dpi = kpathsea_var_value (kpse, \"KPATHSEA_DPI\");\n"
    "        if (ck_dpi) {\n"
    "          ck_target = concatn (base, \".\", ck_dpi,\n"
    "                               format == kpse_pk_format ? \"pk\" : \"gf\",\n"
    "                               (char *) NULL);\n"
    "          free (ck_dpi);\n"
    "        }\n"
    "      } else if (format == kpse_tfm_format) {\n"
    "        ck_target = concat (base, \".tfm\");\n"
    "      }\n"
    "      if (ck_target) {\n"
    "        string ck_fetched = kpse_remote_fetch (ck_target, format);\n"
    "        free (ck_target);\n"
    "        if (ck_fetched) {\n"
    "          for (argnum = 0; args[argnum] != NULL; argnum++)\n"
    "            free (args[argnum]);\n"
    "          free (args);\n"
    "          return ck_fetched;\n"
    "        }\n"
    "      }\n"
    "    }\n\n"
    "    ret = maketex (kpse, format, args);"
)


def patch_tex_file(path: str) -> int:
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


def patch_tex_make(path: str) -> int:
    src = open(path).read()
    if "kpse_remote_fetch" in src:
        print(f"{path}: already patched")
        return 0
    if MK_OLD not in src or MK_INC_OLD not in src:
        print(f"ERROR: could not locate kpathsea_make_tex in {path}", file=sys.stderr)
        return 1
    src = src.replace(MK_INC_OLD, MK_INC_NEW, 1)
    src = src.replace(MK_OLD, MK_NEW, 1)
    open(path, "w").write(src)
    print(f"{path}: patched (font/metric make_tex -> remote fetch)")
    return 0


def main(arg: str) -> int:
    d = arg if os.path.isdir(arg) else os.path.dirname(arg)
    rc = patch_tex_file(os.path.join(d, "tex-file.c"))
    if rc == 0:
        rc = patch_tex_make(os.path.join(d, "tex-make.c"))
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
