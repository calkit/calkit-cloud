export type Body_login_login_access_token = {
  grant_type?: string | null
  username: string
  password: string
  scope?: string
  client_id?: string | null
  client_secret?: string | null
}

export type Figure = {
  id?: string
  project_id: string
  path: string
  title: string
  description: string | null
  pipeline: string | null
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

export type Project = {
  name: string
  description?: string | null
  git_repo_url: string
  is_public?: boolean
  id?: string
  owner_user_id: string
  readonly owner_github_username: string
}

export type ProjectCreate = {
  name: string
  description?: string | null
  git_repo_url: string
  is_public?: boolean
}

export type ProjectPublic = {
  name: string
  description?: string | null
  git_repo_url: string
  is_public?: boolean
  id: string
  owner_user_id: string
  owner_github_username: string | null
  readonly name_slug: string
}

export type ProjectsPublic = {
  data: Array<ProjectPublic>
  count: number
}

export type Question = {
  id?: string
  project_id: string
  question: string
}

export type Token = {
  access_token: string
  token_type?: string
}

export type UpdatePassword = {
  current_password: string
  new_password: string
}

export type UserCreate = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  github_username?: string | null
  password: string
}

export type UserPublic = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  github_username?: string | null
  id: string
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
  github_username?: string | null
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
