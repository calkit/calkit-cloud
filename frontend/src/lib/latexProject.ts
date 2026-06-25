// Load a publication's whole directory of LaTeX sources + figures so the
// in-browser engine can compile a real multi-file project (\input, figures,
// .bib). Text files become editable buffers; images are seeded read-only.
import { ProjectsService } from "../client"
import { decodeBase64Utf8 } from "./strings"

const TEXT_EXT = new Set([
  "tex",
  "bib",
  "cls",
  "sty",
  "bst",
  "bbl",
  "ltx",
  "def",
  "clo",
  "cfg",
])
const IMG_EXT = new Set(["png", "jpg", "jpeg", "pdf", "eps", "gif"])
const MAX_FILES = 100
const MAX_DEPTH = 4

export interface ProjectFile {
  repoPath: string
  relPath: string
  kind: "text" | "binary"
  text?: string
  bytes?: Uint8Array
}

function ext(p: string): string {
  const i = p.lastIndexOf(".")
  return i < 0 ? "" : p.slice(i + 1).toLowerCase()
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i)
  }
  return out
}

async function listRelevantPaths(
  ownerName: string,
  projectName: string,
  dir: string,
  depth: number,
  acc: string[],
): Promise<void> {
  if (depth > MAX_DEPTH || acc.length >= MAX_FILES) {
    return
  }
  const res = await ProjectsService.getProjectContents({
    ownerName,
    projectName,
    path: dir || undefined,
  })
  for (const item of res.dir_items ?? []) {
    if (acc.length >= MAX_FILES) {
      break
    }
    if (item.type === "dir") {
      await listRelevantPaths(ownerName, projectName, item.path, depth + 1, acc)
    } else if (TEXT_EXT.has(ext(item.name)) || IMG_EXT.has(ext(item.name))) {
      acc.push(item.path)
    }
  }
}

function toRel(repoPath: string, baseDir: string): string {
  return baseDir && repoPath.startsWith(`${baseDir}/`)
    ? repoPath.slice(baseDir.length + 1)
    : repoPath
}

async function fetchOne(
  ownerName: string,
  projectName: string,
  repoPath: string,
  baseDir: string,
): Promise<ProjectFile | null> {
  const relPath = toRel(repoPath, baseDir)
  const res = await ProjectsService.getProjectContents({
    ownerName,
    projectName,
    path: repoPath,
  })
  if (TEXT_EXT.has(ext(repoPath))) {
    return {
      repoPath,
      relPath,
      kind: "text",
      text: res.content ? decodeBase64Utf8(res.content) : "",
    }
  }
  let bytes: Uint8Array | null = null
  if (res.content) {
    bytes = base64ToBytes(res.content)
  } else if (res.url) {
    const buf = await (await fetch(res.url)).arrayBuffer()
    bytes = new Uint8Array(buf)
  }
  if (!bytes) {
    return null
  }
  return { repoPath, relPath, kind: "binary", bytes }
}

export async function loadLatexProject(
  ownerName: string,
  projectName: string,
  baseDir: string,
): Promise<ProjectFile[]> {
  const paths: string[] = []
  await listRelevantPaths(ownerName, projectName, baseDir, 0, paths)
  const files = await Promise.all(
    paths.map((p) =>
      fetchOne(ownerName, projectName, p, baseDir).catch(() => null),
    ),
  )
  return files.filter((f): f is ProjectFile => f !== null)
}
