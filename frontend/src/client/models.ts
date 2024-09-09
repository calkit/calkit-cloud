export type Body_login_login_access_token = {
  grant_type?: string | null
  username: string
  password: string
  scope?: string
  client_id?: string | null
  client_secret?: string | null
}

export type Body_projects_post_project_figure = {
  path: string
  title: string
  description: string
  stage?: string | null
  file?: Blob | File | null
}

export type Body_projects_put_project_contents = {
  file: Blob | File
}

export type Collaborator = {
  user_id?: string | null
  github_username: string
  full_name?: string | null
  email?: string | null
  access_level: string
}

export type ContentPatch = {
  kind:
    | "figure"
    | "dataset"
    | "publication"
    | "environment"
    | "references"
    | null
  attrs?: Record<string, unknown>
}

export type ContentsItem = {
  name: string
  path: string
  type: string | null
  size: number | null
  in_repo: boolean
  content?: string | null
  url?: string | null
  calkit_object?: Record<string, unknown> | null
  dir_items?: Array<_ContentsItemBase> | null
}

export type Dataset = {
  id?: string
  project_id: string
  imported_from?: string | null
  path: string
  title?: string | null
  tabular?: boolean | null
  stage?: string | null
  description?: string | null
  url?: string | null
}

export type Environment = {
  kind: "docker" | "conda"
  path: string
  file_content?: string | null
}

export type Figure = {
  path: string
  title: string
  description: string
  stage?: string | null
  dataset?: string | null
  content?: string | null
  url?: string | null
}

export type FigureComment = {
  id?: string
  project_id: string
  figure_path: string
  user_id: string
  created?: string
  updated?: string
  external_url?: string | null
  comment: string
  readonly user_github_username: string
  readonly user_full_name: string
  readonly user_email: string
}

export type FigureCommentPost = {
  figure_path: string
  comment: string
}

export type GitItem = {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string | null
  type: string
}

export type GitItemWithContents = {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string | null
  type: string
  encoding: string
  content: string
}

export type HTTPValidationError = {
  detail?: Array<ValidationError>
}

export type ImportInfo = {
  project_owner: string
  project_name: string
  git_rev?: string | null
  path: string
}

export type Issue = {
  id: number
  number: number
  url: string
  user_github_username: string
  state: "open" | "closed"
  title: string
  body: string | null
}

export type IssuePatch = {
  state: "open" | "closed"
}

export type IssuePost = {
  title: string
  body?: string | null
}

export type ItemCreate = {
  title: string
  description?: string | null
}

export type ItemPublic = {
  title: string
  description?: string | null
  id: string
  owner_id: string
}

export type ItemUpdate = {
  title?: string | null
  description?: string | null
}

export type ItemsPublic = {
  data: Array<ItemPublic>
  count: number
}

export type Message = {
  message: string
}

export type NewPassword = {
  token: string
  new_password: string
}

export type Org = {
  id?: string
  display_name: string
  readonly owned_projects: Array<Project>
}

export type Project = {
  name: string
  title: string
  description?: string | null
  is_public?: boolean
  created?: string | null
  updated?: string | null
  git_repo_url: string
  latest_git_rev?: string | null
  id?: string
  owner_account_id: string
  readonly owner_account_name: string
  readonly owner_account_type: string
  readonly owner_github_name: string
  readonly owner: User | Org
}

export type ProjectCreate = {
  name: string
  title: string
  description?: string | null
  is_public?: boolean
  created?: string | null
  updated?: string | null
  git_repo_url: string
  latest_git_rev?: string | null
}

export type ProjectPublic = {
  name: string
  title: string
  description?: string | null
  is_public?: boolean
  created?: string | null
  updated?: string | null
  git_repo_url: string
  latest_git_rev?: string | null
  id: string
  owner_account_id: string
  owner_account_name: string
  owner_account_type: string
}

export type ProjectsPublic = {
  data: Array<ProjectPublic>
  count: number
}

export type Publication = {
  path: string
  title: string
  description?: string | null
  type?:
    | "journal-article"
    | "conference-paper"
    | "presentation"
    | "poster"
    | "report"
    | "book"
    | null
  stage?: string | null
  content?: string | null
  stage_info?: Stage | null
}

export type Question = {
  id?: string
  project_id: string
  number: number
  question: string
}

export type QuestionPost = {
  question: string
}

export type ReferenceEntry = {
  type: string
  key: string
  file_path?: string | null
  attrs: Record<string, unknown>
}

export type ReferenceFile = {
  path: string
  key: string
}

export type References = {
  path: string
  files?: Array<ReferenceFile> | null
  entries?: Array<ReferenceEntry> | null
  imported_from?: ImportInfo | null
  raw_text?: string | null
}

export type Software = {
  environments: Array<Environment>
}

export type Stage = {
  cmd: string
  wdir?: string | null
  deps?: Array<string> | null
  outs?: Array<string> | null
  desc?: string | null
  meta?: Record<string, unknown> | null
}

export type Token = {
  access_token: string
  token_type?: string
}

export type UpdatePassword = {
  current_password: string
  new_password: string
}

export type User = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  id?: string
  hashed_password: string
  readonly github_username: string
  readonly owned_projects: Array<Project>
}

export type UserCreate = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  password: string
  github_username?: string
}

export type UserPublic = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  id: string
  github_username: string
}

export type UserRegister = {
  email: string
  password: string
  full_name?: string | null
}

export type UserUpdate = {
  email?: string | null
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  password?: string | null
}

export type UserUpdateMe = {
  full_name?: string | null
  email?: string | null
  github_username?: string | null
}

export type UsersPublic = {
  data: Array<UserPublic>
  count: number
}

export type ValidationError = {
  loc: Array<string | number>
  msg: string
  type: string
}

export type Workflow = {
  mermaid: string
  stages: Record<string, WorkflowStage>
  yaml: string
}

export type WorkflowStage = {
  cmd: string
  deps?: Array<string> | null
  outs?: Array<string | Record<string, Record<string, unknown>>> | null
  desc?: string | null
  meta?: Record<string, unknown> | null
  wdir?: string | null
}

export type _ContentsItemBase = {
  name: string
  path: string
  type: string | null
  size: number | null
  in_repo: boolean
  content?: string | null
  url?: string | null
  calkit_object?: Record<string, unknown> | null
}
