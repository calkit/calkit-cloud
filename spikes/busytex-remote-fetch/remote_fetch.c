/* Calkit remote texmf fetch hook for busytex (clean-room, MIT).
 *
 * When kpathsea cannot find a file locally, the patch in tex-file.patch calls
 * kpse_remote_fetch(); this fetches the file from the remote texmf proxy
 * (Module.calkitTexmfEndpoint), writes it into MEMFS, and returns its path so
 * TeX can open it. ONE compile, exact filenames, no log-parsing.
 *
 * Mechanism: a *synchronous* XHR. busytex runs in a Web Worker, where sync XHR
 * is permitted, so no Emscripten Asyncify is required. Binary files use the
 * classic "x-user-defined" charset trick to read bytes via responseText.
 *
 * Caching: results (hit *and* miss) are memoised on Module.__calkitCache so a
 * package's many \IfFileExists probes don't hammer the proxy.
 *
 * This is a clean-room reimplementation of the technique SwiftLaTeX uses; none
 * of their (AGPL) code is used, so the result stays MIT.
 */
#include <emscripten.h>

EM_JS(char *, kpse_remote_fetch, (const char *name_ptr, int format), {
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
      var url =
        Module.calkitTexmfEndpoint.replace(/\/$/, "") +
        "/f/" + encodeURIComponent(name);
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
