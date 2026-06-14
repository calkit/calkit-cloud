// Helpers for the releases feature.

import type { ReleaseListItem } from "../client"

// Build the public, shareable URL for a release from its secret token. Uses the
// current origin so it works across local/staging/prod without extra config.
export const releaseUrl = (secretToken: string): string =>
  `${window.location.origin}/releases/${secretToken}`

// The off-site link for a release, if any: the Calkit-hosted shared link for a
// cloud release, otherwise the declared external URL or a DOI resolver. Returns
// null when the release has no openable link.
export const releaseExternalLink = (
  r: ReleaseListItem,
): { href: string; label: string } | null => {
  if (r.source === "cloud" && r.secret_token)
    return { href: releaseUrl(r.secret_token), label: "shared link" }
  if (r.url)
    return {
      href: r.url,
      label: r.publisher === "github" ? "GitHub release" : "external release",
    }
  if (r.doi) return { href: `https://doi.org/${r.doi}`, label: "DOI" }
  return null
}

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
