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

// Pretty labels for known release locations (archival services / venues).
const LOCATION_LABELS: Record<string, string> = {
  zenodo: "Zenodo",
  caltechdata: "CaltechDATA",
  github: "GitHub",
  arxiv: "arXiv",
  osf: "OSF",
  figshare: "figshare",
  dryad: "Dryad",
}

// Where a release lives: "Calkit" (hosted for review) or the external venue it
// was published to (Zenodo, CaltechDATA, arXiv, …), with the off-site link when
// there is one.
export const releaseLocation = (
  r: ReleaseListItem,
): { label: string; internal: boolean; href: string | null } => {
  // Cloud (hosted) releases always carry internal=true, so the flag alone
  // decides this -- no need to special-case the source.
  if (r.internal) return { label: "Calkit", internal: true, href: null }
  const label = r.publisher
    ? LOCATION_LABELS[r.publisher.toLowerCase()] ?? r.publisher
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

// Build the download filename for a released artifact, matching the calkit CLI
// convention so a downloaded file traces back to its project and release:
// {project}-{stem}-{release}{ext} (e.g. adani-swarm-assessment-slides-v0.pdf).
export const releaseDownloadName = (
  projectName: string,
  releaseName: string,
  path: string,
): string => {
  const base = path.split("/").pop() ?? path
  const dot = base.lastIndexOf(".")
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ""
  return `${projectName}-${stem}-${releaseName}${ext}`
}
