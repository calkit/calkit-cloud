// Helpers for the releases feature.

// Build the public, shareable URL for a release from its secret token. Uses the
// current origin so it works across local/staging/prod without extra config.
export const releaseUrl = (secretToken: string): string =>
  `${window.location.origin}/releases/${secretToken}`

// Build the download filename for a released artifact, appending the git ref
// before the extension (e.g., paper.html + abc1234 -> paper-abc1234.html).
export const releaseDownloadName = (
  path: string,
  ref: string | null | undefined,
): string => {
  const base = path.split("/").pop() ?? path
  if (!ref) return base
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return `${base}-${ref}`
  return `${base.slice(0, dot)}-${ref}${base.slice(dot)}`
}
