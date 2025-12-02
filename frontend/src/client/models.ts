export type AccountPublic = {
  name: string
  github_name: string
  display_name: string
  kind: "user" | "org"
  role?: "self" | "read" | "write" | "admin" | "owner" | null
}

export type Body_login_login_access_token = {
  grant_type?: string | null
  username: string
  password: string
  scope?: string
  client_id?: string | null
  client_secret?: string | null
}

export type Body_projects_post_project_dataset_upload = {
  path: string
  title: string
  description: string
  file: Blob | File
}

export type Body_projects_post_project_figure = {
  path: string
  title: string
  description: string
  stage?: string | null
  file?: Blob | File | null
}

export type Body_projects_post_project_overleaf_publication = {
  path: string
  kind:
    | "journal-article"
    | "conference-paper"
    | "report"
    | "book"
    | "masters-thesis"
    | "phd-thesis"
    | "other"
  overleaf_project_url?: string | null
  title?: string | null
  description?: string | null
  target_path?: string | null
  stage_name?: string | null
  environment_name?: string | null
  overleaf_token?: string | null
  auto_build?: boolean | null
  file?: Blob | File | null
}

export type Body_projects_post_project_publication = {
  path: string
  kind:
    | "journal-article"
    | "conference-paper"
    | "presentation"
    | "poster"
    | "report"
    | "book"
  title: string
  description: string
  stage?: string | null
  template?: string | null
  environment?: string | null
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

export type ConnectedAccounts = {
  github: boolean
  zenodo: boolean
  overleaf: boolean
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
  lock?: ItemLock | null
  dir_items?: Array<_ContentsItemBase> | null
}

/**
 * The necessary information to import a DVC object, which can be saved to
 * a .dvc file.
 *
 * For example:
 *
 * outs:
 * - md5: 46ce259ab949ecb23751eb88ec753ff2
 * size: 83344240
 * hash: md5
 * path: time-ave-profiles.h5
 * remote: calkit:petebachant/boundary-layer-turbulence-modeling
 * push: false
 *
 * Note this is different from the file that would be produced by
 * ``dvc import``, since they bundle in Git repo information to fetch from
 * the original project's remote.
 */
export type DVCImport = {
  outs: Array<DVCOut>
}

export type DVCOut = {
  md5: string
  size: number
  hash?: string
  path: string
  remote: string
  push?: boolean
}

export type Dataset = {
  path: string
  imported_from?: string | null
  title?: string | null
  tabular?: boolean | null
  stage?: string | null
  description?: string | null
  url?: string | null
  id?: string
  project_id: string
}

export type DatasetForImport = {
  path: string
  imported_from?: string | null
  title?: string | null
  tabular?: boolean | null
  stage?: string | null
  description?: string | null
  url?: string | null
  dvc_import?: DVCImport | null
  git_import?: GitImport | null
  git_rev: string
}

export type DatasetResponse = {
  project: ProjectPublic
  path: string
  title: string | null
  description: string | null
  imported_from: string | null
}

export type DatasetsResponse = {
  data: Array<DatasetResponse>
  count: number
}

export type DiscountCode = {
  id?: string
  created?: string
  created_by_user_id: string
  created_for_account_id?: string | null
  valid_from?: string | null
  valid_until?: string | null
  plan_id: number
  price: number
  months: number
  n_users?: number
  redeemed?: string | null
  redeemed_by_user_id?: string | null
}

export type DiscountCodePost = {
  valid_from?: string | null
  valid_until?: string | null
  created_for_account_name?: string | null
  n_users?: number
  plan_name: "standard" | "professional"
  price: number
  months: number
}

export type DiscountCodePublic = {
  id: string
  is_valid?: boolean
  reason?: string | null
  n_users?: number | null
  price?: number | null
  months?: number | null
  plan_name?: string | null
}

export type DvcForeachStage = {
  foreach: Array<string> | string
  do: DvcPipelineStage
}

export type DvcPipelineStage = {
  cmd: string
  deps?: Array<string> | null
  outs?: Array<string | Record<string, Record<string, unknown>>> | null
  desc?: string | null
  meta?: Record<string, unknown> | null
  wdir?: string | null
}

export type Environment = {
  name: string
  kind: string
  path?: string | null
  description?: string | null
  imported_from?: string | null
  all_attrs: Record<string, unknown>
  file_content?: string | null
}

export type ExternalTokenResponse = {
  access_token: string
}

export type Figure = {
  path: string
  title: string
  description?: string | null
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
  readonly user_full_name: string | null
  readonly user_email: string
}

export type FigureCommentPost = {
  figure_path: string
  comment: string
}

export type FileLock = {
  project_id: string
  path: string
  created?: string
  user_id: string
  readonly user_github_username: string
  readonly user_email: string
}

export type FileLockPost = {
  path: string
}

export type GitHubInstallations = {
  total_count: number
  installations: Array<Record<string, unknown>>
}

export type GitHubRelease = {
  url: string
  name: string
  tag_name: string
  body: string
  created: string
  published: string
}

export type GitHubReleasePost = {
  tag_name: string
  target_committish?: string
  name?: string | null
  body: string
  generate_release_notes?: boolean
}

export type GitImport = {
  files: Array<string>
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

export type ItemLock = {
  created: string
  user_id: string
  user_email: string
  user_github_username: string
}

export type LabelDatasetPost = {
  imported_from?: string | null
  path: string
  title?: string | null
  tabular?: boolean | null
  stage?: string | null
  description?: string | null
}

export type Message = {
  message: string
}

export type NewPassword = {
  token: string
  new_password: string
}

export type Notebook = {
  path: string
  title: string
  description?: string | null
  stage?: string | null
  output_format?: "html" | "notebook" | null
  url?: string | null
  content?: string | null
}

export type OrgMemberPost = {
  username: string
  role: "read" | "write" | "admin" | "owner"
}

export type OrgPost = {
  name?: string | null
  display_name?: string | null
  github_name: string
}

export type OrgPublic = {
  id: string
  name: string
  display_name: string
  github_name: string
  role: string
}

export type OrgSubscription = {
  id?: string
  created?: string
  period_months: number
  price: number
  paid_until?: string | null
  plan_id: number
  is_active?: boolean
  processor?: string | null
  processor_product_id?: string | null
  processor_price_id?: string | null
  processor_subscription_id?: string | null
  org_id: string
  n_users: number
  subscriber_user_id: string
  readonly plan_name: string
}

export type OrgSubscriptionUpdate = {
  plan_name: "standard" | "professional"
  period: "monthly" | "annual"
  discount_code?: string | null
  n_users: number
}

export type OrgUserPublic = {
  name: string
  github_name: string
  role: string
}

export type OrgsResponse = {
  data: Array<OrgPublic>
  count: number
}

export type OverleafSyncPost = {
  path: string
}

export type OverleafSyncResponse = {
  commits_from_overleaf: number
  overleaf_commit: string
  project_commit: string
  committed_overleaf: boolean
  committed_project: boolean
}

export type Pipeline = {
  mermaid: string
  dvc_stages: Record<string, DvcPipelineStage | DvcForeachStage>
  dvc_yaml: string
  calkit_yaml: string | null
}

export type ProjectApp = {
  path?: string | null
  url?: string | null
  title?: string | null
  description?: string | null
}

export type ProjectCreate = {
  name: string
  title: string
  description?: string | null
  is_public?: boolean
  created?: string | null
  updated?: string | null
  git_repo_url?: string | null
  latest_git_rev?: string | null
  status?: string | null
  status_updated?: string | null
  status_message?: string | null
  template?: string | null
}

export type ProjectOptionalExtended = {
  name: string
  title: string
  description?: string | null
  is_public?: boolean
  created?: string | null
  updated?: string | null
  git_repo_url: string
  latest_git_rev?: string | null
  status?: string | null
  status_updated?: string | null
  status_message?: string | null
  id: string
  owner_account_id: string
  owner_account_name: string
  owner_account_type: string
  current_user_access?: "read" | "write" | "admin" | "owner" | null
  calkit_info_keys?: Array<string> | null
  readme_content?: string | null
}

export type ProjectPatch = {
  title?: string | null
  description?: string | null
  is_public?: boolean | null
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
  status?: string | null
  status_updated?: string | null
  status_message?: string | null
  id: string
  owner_account_id: string
  owner_account_name: string
  owner_account_type: string
  current_user_access?: "read" | "write" | "admin" | "owner" | null
}

export type ProjectStatus = {
  timestamp: string
  status: "in-progress" | "on-hold" | "completed"
  message?: string | null
}

export type ProjectStatusPost = {
  status: "in-progress" | "on-hold" | "completed"
  message?: string | null
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
  stage_info?: DvcPipelineStage | null
  url?: string | null
  overleaf?: PublicationOverleaf | null
}

export type PublicationOverleaf = {
  project_id: string
  wdir?: string | null
  url?: string | null
  push_paths?: Array<string>
  sync_paths?: Array<string>
  last_sync_commit: string | null
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
  url?: string | null
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

export type ReproCheck = {
  has_pipeline: boolean
  has_readme: boolean
  instructions_in_readme: boolean
  is_dvc_repo: boolean
  is_git_repo: boolean
  has_calkit_info: boolean
  has_dev_container: boolean
  n_environments: number
  n_stages: number
  stages_with_env: Array<string>
  stages_without_env: Array<string>
  n_datasets: number
  n_datasets_no_import_or_stage: number
  n_figures: number
  n_figures_no_import_or_stage: number
  n_publications: number
  n_publications_no_import_or_stage: number
  n_dvc_remotes: number
  /**
   * Formulate a recommendation for the project.
   */
  readonly recommendation: string | null
  readonly n_datasets_with_import_or_stage: number
  readonly n_figures_with_import_or_stage: number
  readonly n_publications_with_import_or_stage: number
  readonly n_stages_without_env: number
  readonly n_stages_with_env: number
}

export type Showcase = {
  elements: Array<
    | ShowcaseFigure
    | ShowcasePublication
    | ShowcaseText
    | ShowcaseMarkdown
    | ShowcaseYaml
    | ShowcaseNotebook
  >
}

export type ShowcaseFigure = {
  figure: Figure
}

export type ShowcaseMarkdown = {
  markdown: string
}

export type ShowcaseNotebook = {
  notebook: Notebook
}

export type ShowcasePublication = {
  publication: Publication
}

export type ShowcaseText = {
  text: string
}

export type ShowcaseYaml = {
  yaml: string
}

export type Software = {
  environments: Array<Environment>
}

export type StorageUsage = {
  limit_gb: number
  used_gb: number
}

export type SubscriptionPlan = {
  name: string
  id: number
  price: number
  private_projects_limit: number | null
  storage_limit: number
  annual_discount_factor?: number
}

export type SubscriptionUpdate = {
  plan_name: "free" | "standard" | "professional"
  period: "monthly" | "annual"
  discount_code?: string | null
}

export type Token = {
  access_token: string
  token_type?: string
}

export type TokenPatch = {
  is_active: boolean
}

export type TokenPost = {
  expires_days: number
  scope: "dvc" | null
  description?: string | null
}

export type TokenPut = {
  token: string
  expires?: string | null
}

export type TokenResp = {
  access_token: string
  token_type?: string
  id?: string
  user_id: string
  scope?: string | null
  created?: string
  updated?: string
  expires: string
  is_active: boolean
  description?: string | null
  last_used?: string | null
}

export type UpdatePassword = {
  current_password: string
  new_password: string
}

export type UpdateSubscriptionResponse = {
  subscription: UserSubscription | OrgSubscription
  stripe_session_client_secret: string | null
}

export type UserCreate = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  password: string
  account_name?: string | null
  github_username?: string
}

export type UserPublic = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  id: string
  github_username: string
  subscription: UserSubscription | null
}

export type UserRegister = {
  email: string
  password: string
  account_name?: string | null
  full_name?: string | null
}

export type UserSubscription = {
  id?: string
  created?: string
  period_months: number
  price: number
  paid_until?: string | null
  plan_id: number
  is_active?: boolean
  processor?: string | null
  processor_product_id?: string | null
  processor_price_id?: string | null
  processor_subscription_id?: string | null
  user_id: string
  readonly plan_name: string
}

export type UserTokenPublic = {
  id?: string
  user_id: string
  scope?: string | null
  created?: string
  updated?: string
  expires: string
  is_active: boolean
  description?: string | null
  last_used?: string | null
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

export type _ContentsItemBase = {
  name: string
  path: string
  type: string | null
  size: number | null
  in_repo: boolean
  content?: string | null
  url?: string | null
  calkit_object?: Record<string, unknown> | null
  lock?: ItemLock | null
}
