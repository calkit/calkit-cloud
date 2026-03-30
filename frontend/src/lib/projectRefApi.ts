import axios from "axios"

import {
  OpenAPI,
  type ContentsItem,
  type Figure,
  type Notebook,
  type Publication,
} from "../client"

async function authHeaders() {
  const tokenSource = OpenAPI.TOKEN
  const token =
    typeof tokenSource === "string"
      ? tokenSource
      : localStorage.getItem("access_token") || undefined
  if (!token) {
    return undefined
  }
  return { Authorization: `Bearer ${token}` }
}

export async function getProjectContentsAtRef(params: {
  ownerName: string
  projectName: string
  path?: string
  ref?: string
}) {
  const { ownerName, projectName, path, ref } = params
  const headers = await authHeaders()
  const response = await axios.get<ContentsItem>(
    `${OpenAPI.BASE}/projects/${ownerName}/${projectName}/contents`,
    {
      params: { path, ref },
      headers,
    },
  )
  return response.data
}

export interface CommitHistory {
  hash: string
  short_hash: string
  message: string
  author: string
  author_email: string
  timestamp: string
  committed_date: number
  parent_hashes: string[]
  summary: string
}

export async function getProjectHistory(params: {
  ownerName: string
  projectName: string
  limit?: number
}): Promise<CommitHistory[]> {
  const { ownerName, projectName, limit = 100 } = params
  const headers = await authHeaders()
  const response = await axios.get<CommitHistory[]>(
    `${OpenAPI.BASE}/projects/${ownerName}/${projectName}/git/history`,
    {
      params: { limit },
      headers,
    },
  )
  return response.data
}

export async function getProjectFiguresAtRef(params: {
  ownerName: string
  projectName: string
  ref?: string
}) {
  const { ownerName, projectName, ref } = params
  const headers = await authHeaders()
  const response = await axios.get<Figure[]>(
    `${OpenAPI.BASE}/projects/${ownerName}/${projectName}/figures`,
    {
      params: { ref },
      headers,
    },
  )
  return response.data
}

export async function getProjectNotebooksAtRef(params: {
  ownerName: string
  projectName: string
  ref?: string
}) {
  const { ownerName, projectName, ref } = params
  const headers = await authHeaders()
  const response = await axios.get<Notebook[]>(
    `${OpenAPI.BASE}/projects/${ownerName}/${projectName}/notebooks`,
    {
      params: { ref },
      headers,
    },
  )
  return response.data
}

export async function getProjectPublicationsAtRef(params: {
  ownerName: string
  projectName: string
  ref?: string
}) {
  const { ownerName, projectName, ref } = params
  const headers = await authHeaders()
  const response = await axios.get<Publication[]>(
    `${OpenAPI.BASE}/projects/${ownerName}/${projectName}/publications`,
    {
      params: { ref },
      headers,
    },
  )
  return response.data
}

export interface Ref {
  name: string
  type: "branch" | "tag" | "commit"
  message?: string
  author?: string
  timestamp?: string
  short_hash?: string
}

export async function searchProjectRefs(params: {
  ownerName: string
  projectName: string
  q?: string
}): Promise<Ref[]> {
  const { ownerName, projectName, q } = params
  const headers = await authHeaders()
  const response = await axios.get<Ref[]>(
    `${OpenAPI.BASE}/projects/${ownerName}/${projectName}/git/refs`,
    {
      params: { q },
      headers,
    },
  )
  return response.data
}
