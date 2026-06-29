#!/usr/bin/env python3
"""Insert the Calkit remote-fetch fallback into kpathsea's tex-file.c.

More robust than a context diff: matches the `kpathsea_find_file` function and
edits it, so it survives line drift across TeX Live point releases. Idempotent.

Usage: apply_patch.py path/to/texk/kpathsea/tex-file.c
"""
import sys

EXTERN = (
    "/* Calkit: defined in remote_fetch.c — on a local miss, fetch from the\n"
    "   remote texmf proxy into MEMFS and return its path (or NULL). */\n"
    "extern string kpse_remote_fetch (const_string name,\n"
    "                                 kpse_file_format_type format);\n\n"
)
FUNC_SIG = "kpathsea_find_file (kpathsea kpse, const_string name,"
OLD = "  string ret = *ret_list;\n  free (ret_list);\n  return ret;\n}"
NEW = (
    "  string ret = *ret_list;\n"
    "  free (ret_list);\n"
    "  if (ret == NULL)\n"
    "    ret = kpse_remote_fetch (name, format);\n"
    "  return ret;\n}"
)


def main(path: str) -> int:
    src = open(path).read()
    if "kpse_remote_fetch" in src:
        print(f"{path}: already patched")
        return 0
    if FUNC_SIG not in src or OLD not in src:
        print(f"ERROR: could not locate kpathsea_find_file in {path}", file=sys.stderr)
        return 1
    # Insert the extern just before the function's return type line.
    marker = "\nstring\n" + FUNC_SIG
    src = src.replace(marker, "\n" + EXTERN + "string\n" + FUNC_SIG, 1)
    # Insert the fallback before `return ret;` of that function.
    src = src.replace(OLD, NEW, 1)
    open(path, "w").write(src)
    print(f"{path}: patched")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
