// Helpers for the releases feature.

import type { ReleaseListItem } from "../client"

// Build the in-app path to a release's page. Project members open it directly;
// a share recipient appends their ?token=... to view (and maybe comment)
// without signing up.
export const releasePagePath = (
  ownerName: string,
  projectName: string,
  releaseName: string,
  token?: string | null,
): string => {
  const base = `/${ownerName}/${projectName}/releases/${encodeURIComponent(
    releaseName,
  )}`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

// Absolute URL for a release page, using the current origin so it works across
// local/staging/prod without extra config.
export const releasePageUrl = (
  ownerName: string,
  projectName: string,
  releaseName: string,
  token?: string | null,
): string =>
  `${window.location.origin}${releasePagePath(
    ownerName,
    projectName,
    releaseName,
    token,
  )}`

// Pretty labels for known release destinations (archival services / venues).
const DESTINATION_LABELS: Record<string, string> = {
  zenodo: "Zenodo",
  caltechdata: "CaltechDATA",
  github: "GitHub",
  arxiv: "arXiv",
  osf: "OSF",
  figshare: "figshare",
  dryad: "Dryad",
}

// Where a release went: "Internal" (hosted on Calkit for review) or the
// external venue it was published to (Zenodo, CaltechDATA, arXiv, …), with the
// off-site link when there is one.
export const releaseDestination = (
  r: ReleaseListItem,
): { label: string; internal: boolean; href: string | null } => {
  if (r.source === "cloud" || r.internal)
    return { label: "Internal", internal: true, href: null }
  const label = r.publisher
    ? DESTINATION_LABELS[r.publisher.toLowerCase()] ?? r.publisher
    : "External"
  const href = r.url ?? (r.doi ? `https://doi.org/${r.doi}` : null)
  return { label, internal: false, href }
}

// The openable link for a release, if any: the Calkit-hosted page for a cloud
// release, otherwise the declared external URL or a DOI resolver. ``internal``
// marks the in-app page (same origin) vs an off-site link. Returns null when
// the release has no openable link.
export const releaseExternalLink = (
  r: ReleaseListItem,
  ownerName?: string,
  projectName?: string,
): { href: string; label: string; internal: boolean } | null => {
  if (r.source === "cloud" && ownerName && projectName)
    return {
      href: releasePagePath(ownerName, projectName, r.name),
      label: "release page",
      internal: true,
    }
  if (r.url)
    return {
      href: r.url,
      label: r.publisher === "github" ? "GitHub release" : "external release",
      internal: false,
    }
  if (r.doi)
    return { href: `https://doi.org/${r.doi}`, label: "DOI", internal: false }
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
