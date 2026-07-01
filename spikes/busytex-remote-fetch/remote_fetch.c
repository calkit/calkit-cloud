/* Calkit remote texmf fetch (clean-room, MIT) — ENGINE side.
 *
 * This snippet is appended to busytex's own busytex.c, so it is linked ONLY
 * into the final busytex engine, never into the standalone applets (kpsewhich,
 * bibtex8, ...). That matters: EM_JS defines a JS-import symbol, and several of
 * busytex's standalone applet link steps reject an undefined/JS-import symbol
 * pulled in transitively via libkpathsea. Keeping the EM_JS here — plus a
 * pure-C indirection in kpathsea (see apply_patch.py) — means every binary
 * links cleanly and only the engine carries the browser fetch.
 *
 * Mechanism: kpathsea, on a local miss, calls its kpse_remote_fetch(), which
 * delegates through kpse_remote_fetch_hook. The constructor below installs
 * calkit_remote_fetch_js into that hook at engine startup. The fetch is a
 * *synchronous* XHR — busytex runs in a Web Worker where sync XHR is permitted,
 * so no Emscripten Asyncify is required. Binary files are read byte-exact via
 * the classic "x-user-defined" charset trick. Hits AND misses are memoised on
 * Module.__calkitCache so a package's many \IfFileExists probes don't hammer
 * the proxy. Clean-room reimplementation of the SwiftLaTeX technique; none of
 * their (AGPL) code is used, so the result stays MIT.
 *
 * Set Module.calkitTexmfEndpoint (e.g. the latex-package-proxy) before init.
 */
#include <emscripten.h>

extern char *(*kpse_remote_fetch_hook) (const char *name, int format);

EM_JS(char *, calkit_remote_fetch_js, (const char *name_ptr, int format), {
  var name = UTF8ToString(name_ptr);
  /* Only basename lookups; reject path traversal. */
  if (!name || name.indexOf("..") >= 0 || name.indexOf("/") >= 0) return 0;
  if (typeof Module === "undefined" || !Module.calkitTexmfEndpoint) return 0;
  Module.__calkitCache = Module.__calkitCache || {};
  var cached = Module.__calkitCache[name];
  if (cached === null) return 0;            /* known-missing: don't re-ask */
  var path;
  if (cached === undefined) {
    path = null;
    try {
      var ep = Module.calkitTexmfEndpoint;
      if (ep.charAt(ep.length - 1) === "/") ep = ep.substr(0, ep.length - 1);
      var url = ep + "/f/" + encodeURIComponent(name);
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);          /* synchronous */
      xhr.overrideMimeType("text/plain; charset=x-user-defined");
      xhr.send();
      if (xhr.status === 200) {
        var s = xhr.responseText;
        var bytes = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
        var dir = "/calkit-remote";
        try { FS.mkdir(dir); } catch (e) {}
        path = dir + "/" + name;
        FS.writeFile(path, bytes);
      }
    } catch (e) {
      path = null;
    }
    Module.__calkitCache[name] = path;
  } else {
    path = cached;
  }
  if (!path) return 0;
  var len = lengthBytesUTF8(path) + 1;
  var ptr = _malloc(len);
  stringToUTF8(path, ptr, len);
  return ptr;                               /* TeX frees / owns this string */
});

/* Install the hook into kpathsea at engine startup. */
__attribute__((constructor))
static void calkit_install_remote_fetch(void)
{
  kpse_remote_fetch_hook = calkit_remote_fetch_js;
}
