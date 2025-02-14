import type { CancelablePromise } from "./core/CancelablePromise"
import { OpenAPI } from "./core/OpenAPI"
import { request as __request } from "./core/request"

import type {
  Body_login_login_access_token,
  Message,
  NewPassword,
  Token,
  UserPublic,
  ConnectedAccounts,
  ExternalTokenResponse,
  GitHubInstallations,
  NewSubscriptionResponse,
  StorageUsage,
  SubscriptionUpdate,
  TokenPatch,
  TokenPost,
  TokenResp,
  UpdatePassword,
  UserCreate,
  UserRegister,
  UsersPublic,
  UserSubscription,
  UserToken,
  UserUpdate,
  UserUpdateMe,
  DiscountCode,
  DiscountCodePost,
  DiscountCodePublic,
  SubscriptionPlan,
  Body_projects_post_project_dataset_upload,
  Body_projects_post_project_figure,
  Body_projects_post_project_publication,
  Body_projects_put_project_contents,
  Collaborator,
  ContentPatch,
  ContentsItem,
  Dataset,
  DatasetDVCImport,
  Environment,
  Figure,
  FigureComment,
  FigureCommentPost,
  FileLock,
  FileLockPost,
  GitHubRelease,
  GitHubReleasePost,
  GitItem,
  GitItemWithContents,
  Issue,
  IssuePatch,
  IssuePost,
  LabelDatasetPost,
  Notebook,
  Pipeline,
  ProjectApp,
  ProjectCreate,
  ProjectPatch,
  ProjectPublic,
  ProjectsPublic,
  Publication,
  Question,
  QuestionPost,
  References,
  ReproCheck,
  Showcase,
  Software,
  OrgMemberPost,
  OrgPost,
  OrgPublic,
  OrgSubscriptionUpdate,
  DatasetsResponse,
} from "./models"

export type LoginData = {
  LoginAccessToken: {
    formData: Body_login_login_access_token
  }
  RecoverPassword: {
    email: string
  }
  ResetPassword: {
    requestBody: NewPassword
  }
  RecoverPasswordHtmlContent: {
    email: string
  }
  LoginWithGithub: {
    code: string
  }
}

export type UsersData = {
  ReadUsers: {
    limit?: number
    skip?: number
  }
  CreateUser: {
    requestBody: UserCreate
  }
  UpdateCurrentUser: {
    requestBody: UserUpdateMe
  }
  UpdateCurrentUserPassword: {
    requestBody: UpdatePassword
  }
  RegisterUser: {
    requestBody: UserRegister
  }
  ReadUserById: {
    userId: string
  }
  UpdateUser: {
    requestBody: UserUpdate
    userId: string
  }
  DeleteUser: {
    userId: string
  }
  GetUserGithubRepos: {
    page?: number
    perPage?: number
  }
  PutUserSubscription: {
    requestBody: SubscriptionUpdate
  }
  PostUserSubscription: {
    requestBody: SubscriptionUpdate
  }
  GetUserTokens: {
    isActive?: boolean | null
  }
  PostUserToken: {
    requestBody: TokenPost
  }
  PatchUserToken: {
    requestBody: TokenPatch
    tokenId: string
  }
  PostUserZenodoAuth: {
    code: string
    redirectUri: string
  }
}

export type MiscData = {
  TestEmail: {
    emailTo: string
  }
  GetDiscountCode: {
    discountCode: string
    nUsers?: number
  }
  PostDiscountCode: {
    requestBody: DiscountCodePost
  }
}

export type ProjectsData = {
  GetProjects: {
    limit?: number
    offset?: number
    searchFor?: string | null
  }
  CreateProject: {
    requestBody: ProjectCreate
  }
  GetOwnedProjects: {
    limit?: number
    offset?: number
    searchFor?: string | null
  }
  GetProject: {
    ownerName: string
    projectName: string
  }
  PatchProject: {
    ownerName: string
    projectName: string
    requestBody: ProjectPatch
  }
  DeleteProject: {
    ownerName: string
    projectName: string
  }
  DeleteProjectById: {
    projectId: string
  }
  GetProjectGitRepo: {
    ownerName: string
    projectName: string
  }
  PostProjectDvcFile: {
    idx: string
    md5: string
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectDvcFile: {
    idx: string
    md5: string
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectDvcFiles: {
    ownerName: string
    projectName: string
  }
  GetProjectGitContents: {
    astype?: "" | ".raw" | ".html" | ".object"
    ownerName: string
    path?: string | null
    projectName: string
  }
  GetProjectGitContents1: {
    astype?: "" | ".raw" | ".html" | ".object"
    ownerName: string
    path: string | null
    projectName: string
  }
  GetProjectContents: {
    ownerName: string
    path?: string | null
    projectName: string
    ttl?: number | null
  }
  GetProjectContents1: {
    ownerName: string
    path: string | null
    projectName: string
    ttl?: number | null
  }
  PutProjectContents: {
    contentLength: number
    formData: Body_projects_put_project_contents
    ownerName: string
    path: string
    projectName: string
  }
  PatchProjectContents: {
    ownerName: string
    path: string
    projectName: string
    requestBody: ContentPatch
  }
  GetProjectQuestions: {
    ownerName: string
    projectName: string
  }
  PostProjectQuestion: {
    ownerName: string
    projectName: string
    requestBody: QuestionPost
  }
  GetProjectFigures: {
    ownerName: string
    projectName: string
  }
  PostProjectFigure: {
    formData: Body_projects_post_project_figure
    ownerName: string
    projectName: string
  }
  GetProjectFigure: {
    figurePath: string
    ownerName: string
    projectName: string
    ttl?: number | null
  }
  GetFigureComments: {
    figurePath?: string | null
    ownerName: string
    projectName: string
  }
  PostFigureComment: {
    ownerName: string
    projectName: string
    requestBody: FigureCommentPost
  }
  GetProjectDatasets: {
    ownerName: string
    projectName: string
  }
  GetProjectDataset: {
    ownerName: string
    path: string
    projectName: string
  }
  PostProjectDatasetLabel: {
    ownerName: string
    projectName: string
    requestBody: LabelDatasetPost
  }
  PostProjectDatasetUpload: {
    contentLength: number
    formData: Body_projects_post_project_dataset_upload
    ownerName: string
    projectName: string
  }
  GetProjectPublications: {
    ownerName: string
    projectName: string
  }
  PostProjectPublication: {
    formData: Body_projects_post_project_publication
    ownerName: string
    projectName: string
  }
  PostProjectSync: {
    ownerName: string
    projectName: string
  }
  GetProjectPipeline: {
    ownerName: string
    projectName: string
  }
  GetProjectCollaborators: {
    ownerName: string
    projectName: string
  }
  PutProjectCollaborator: {
    githubUsername: string
    ownerName: string
    projectName: string
  }
  DeleteProjectCollaborator: {
    githubUsername: string
    ownerName: string
    projectName: string
  }
  GetProjectIssues: {
    ownerName: string
    page?: number
    perPage?: number
    projectName: string
    state?: "open" | "closed" | "all"
  }
  PostProjectIssue: {
    ownerName: string
    projectName: string
    requestBody: IssuePost
  }
  PatchProjectIssue: {
    issueNumber: number
    ownerName: string
    projectName: string
    requestBody: IssuePatch
  }
  GetProjectReferences: {
    ownerName: string
    projectName: string
  }
  GetProjectEnvironments: {
    ownerName: string
    projectName: string
  }
  GetProjectSoftware: {
    ownerName: string
    projectName: string
  }
  GetProjectFileLocks: {
    ownerName: string
    projectName: string
  }
  PostProjectFileLock: {
    ownerName: string
    projectName: string
    requestBody: FileLockPost
  }
  DeleteProjectFileLock: {
    ownerName: string
    projectName: string
    requestBody: FileLockPost
  }
  GetProjectNotebooks: {
    ownerName: string
    projectName: string
  }
  GetProjectReproCheck: {
    ownerName: string
    projectName: string
  }
  PutProjectDevContainer: {
    ownerName: string
    projectName: string
  }
  GetProjectApp: {
    ownerName: string
    projectName: string
  }
  GetProjectShowcase: {
    ownerName: string
    projectName: string
    ttl?: number | null
  }
  GetProjectGithubReleases: {
    ownerName: string
    projectName: string
  }
  PostProjectGithubRelease: {
    ownerName: string
    projectName: string
    requestBody: GitHubReleasePost
  }
}

export type OrgsData = {
  PostOrg: {
    requestBody: OrgPost
  }
  AddOrgMember: {
    orgName: string
    requestBody: OrgMemberPost
  }
  PostOrgSubscription: {
    orgName: string
    requestBody: OrgSubscriptionUpdate
  }
  GetOrgStorage: {
    orgName: string
  }
}

export type DatasetsData = {
  GetDatasets: {
    includeImported?: boolean
    limit?: number
    offset?: number
  }
}

export class LoginService {
  /**
   * Login Access Token
   * Get an access token for future requests.
   * @returns Token Successful Response
   * @throws ApiError
   */
  public static loginAccessToken(
    data: LoginData["LoginAccessToken"],
  ): CancelablePromise<Token> {
    const { formData } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/login/access-token",
      formData: formData,
      mediaType: "application/x-www-form-urlencoded",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Test Token
   * Test access token.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static testToken(): CancelablePromise<UserPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/login/test-token",
    })
  }

  /**
   * Recover Password
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static recoverPassword(
    data: LoginData["RecoverPassword"],
  ): CancelablePromise<Message> {
    const { email } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/password-recovery/{email}",
      path: {
        email,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Reset Password
   * Reset password.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static resetPassword(
    data: LoginData["ResetPassword"],
  ): CancelablePromise<Message> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/reset-password/",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Recover Password Html Content
   * Get HTML content for password recovery.
   * @returns string Successful Response
   * @throws ApiError
   */
  public static recoverPasswordHtmlContent(
    data: LoginData["RecoverPasswordHtmlContent"],
  ): CancelablePromise<string> {
    const { email } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/password-recovery-html-content/{email}",
      path: {
        email,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Login With Github
   * Log in a user from GitHub authentication, creating a new account if
   * necessary.
   *
   * The response from GitHub, after parsing into a dictionary, will look
   * something like:
   *
   * ```
   * {'access_token': '...',
   * 'expires_in': '28800',
   * 'refresh_token': '...',
   * 'refresh_token_expires_in': '15897600',
   * 'scope': '',
   * 'token_type': 'bearer'}
   * ```
   * @returns Token Successful Response
   * @throws ApiError
   */
  public static loginWithGithub(
    data: LoginData["LoginWithGithub"],
  ): CancelablePromise<Token> {
    const { code } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/login/github",
      query: {
        code,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export class UsersService {
  /**
   * Read Users
   * Retrieve users.
   * @returns UsersPublic Successful Response
   * @throws ApiError
   */
  public static readUsers(
    data: UsersData["ReadUsers"] = {},
  ): CancelablePromise<UsersPublic> {
    const { skip = 0, limit = 100 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/users",
      query: {
        skip,
        limit,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Create User
   * Create new user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static createUser(
    data: UsersData["CreateUser"],
  ): CancelablePromise<UserPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/users",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Current User
   * Get current user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static getCurrentUser(): CancelablePromise<UserPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/user",
    })
  }

  /**
   * Delete Current User
   * Delete own user.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteCurrentUser(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/user",
    })
  }

  /**
   * Update Current User
   * Update own user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static updateCurrentUser(
    data: UsersData["UpdateCurrentUser"],
  ): CancelablePromise<UserPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/user",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Current User Password
   * Update own password.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static updateCurrentUserPassword(
    data: UsersData["UpdateCurrentUserPassword"],
  ): CancelablePromise<Message> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/user/password",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Register User
   * Create new user without the need to be logged in.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static registerUser(
    data: UsersData["RegisterUser"],
  ): CancelablePromise<UserPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/users/signup",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read User By Id
   * Get a specific user by ID.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static readUserById(
    data: UsersData["ReadUserById"],
  ): CancelablePromise<UserPublic> {
    const { userId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/users/{user_id}",
      path: {
        user_id: userId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update User
   * Update a user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static updateUser(
    data: UsersData["UpdateUser"],
  ): CancelablePromise<UserPublic> {
    const { userId, requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/users/{user_id}",
      path: {
        user_id: userId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete User
   * Delete a user.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteUser(
    data: UsersData["DeleteUser"],
  ): CancelablePromise<Message> {
    const { userId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/users/{user_id}",
      path: {
        user_id: userId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get User Github Repos
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getUserGithubRepos(
    data: UsersData["GetUserGithubRepos"] = {},
  ): CancelablePromise<Array<Record<string, unknown>>> {
    const { perPage = 30, page = 1 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/github/repos",
      query: {
        per_page: perPage,
        page,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Put User Subscription
   * @returns UserSubscription Successful Response
   * @throws ApiError
   */
  public static putUserSubscription(
    data: UsersData["PutUserSubscription"],
  ): CancelablePromise<UserSubscription> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "PUT",
      url: "/user/subscription",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post User Subscription
   * @returns NewSubscriptionResponse Successful Response
   * @throws ApiError
   */
  public static postUserSubscription(
    data: UsersData["PostUserSubscription"],
  ): CancelablePromise<NewSubscriptionResponse> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/user/subscription",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get User Tokens
   * @returns UserToken Successful Response
   * @throws ApiError
   */
  public static getUserTokens(
    data: UsersData["GetUserTokens"] = {},
  ): CancelablePromise<Array<UserToken>> {
    const { isActive } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/tokens",
      query: {
        is_active: isActive,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post User Token
   * @returns TokenResp Successful Response
   * @throws ApiError
   */
  public static postUserToken(
    data: UsersData["PostUserToken"],
  ): CancelablePromise<TokenResp> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/user/tokens",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Patch User Token
   * @returns UserToken Successful Response
   * @throws ApiError
   */
  public static patchUserToken(
    data: UsersData["PatchUserToken"],
  ): CancelablePromise<UserToken> {
    const { tokenId, requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/user/tokens/{token_id}",
      path: {
        token_id: tokenId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get User Github App Installations
   * @returns GitHubInstallations Successful Response
   * @throws ApiError
   */
  public static getUserGithubAppInstallations(): CancelablePromise<GitHubInstallations> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/github-app-installations",
    })
  }

  /**
   * Get User Connected Accounts
   * @returns ConnectedAccounts Successful Response
   * @throws ApiError
   */
  public static getUserConnectedAccounts(): CancelablePromise<ConnectedAccounts> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/connected-accounts",
    })
  }

  /**
   * Post User Zenodo Auth
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static postUserZenodoAuth(
    data: UsersData["PostUserZenodoAuth"],
  ): CancelablePromise<Message> {
    const { code, redirectUri } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/user/zenodo-auth",
      query: {
        code,
        redirect_uri: redirectUri,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get User Zenodo Token
   * @returns ExternalTokenResponse Successful Response
   * @throws ApiError
   */
  public static getUserZenodoToken(): CancelablePromise<ExternalTokenResponse> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/zenodo-token",
    })
  }

  /**
   * Get User Github Token
   * @returns ExternalTokenResponse Successful Response
   * @throws ApiError
   */
  public static getUserGithubToken(): CancelablePromise<ExternalTokenResponse> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/github-token",
    })
  }

  /**
   * Get User Storage
   * @returns StorageUsage Successful Response
   * @throws ApiError
   */
  public static getUserStorage(): CancelablePromise<StorageUsage> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/storage",
    })
  }
}

export class MiscService {
  /**
   * Test Email
   * Test emails.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static testEmail(
    data: MiscData["TestEmail"],
  ): CancelablePromise<Message> {
    const { emailTo } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/test-email/",
      query: {
        email_to: emailTo,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Discount Code
   * @returns DiscountCodePublic Successful Response
   * @throws ApiError
   */
  public static getDiscountCode(
    data: MiscData["GetDiscountCode"],
  ): CancelablePromise<DiscountCodePublic> {
    const { discountCode, nUsers = 1 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/discount-codes/{discount_code}",
      path: {
        discount_code: discountCode,
      },
      query: {
        n_users: nUsers,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Discount Code
   * @returns DiscountCode Successful Response
   * @throws ApiError
   */
  public static postDiscountCode(
    data: MiscData["PostDiscountCode"],
  ): CancelablePromise<DiscountCode> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/discount-codes",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Subscription Plans
   * @returns SubscriptionPlan Successful Response
   * @throws ApiError
   */
  public static getSubscriptionPlans(): CancelablePromise<
    Array<SubscriptionPlan>
  > {
    return __request(OpenAPI, {
      method: "GET",
      url: "/subscription-plans",
    })
  }
}

export class ProjectsService {
  /**
   * Get Projects
   * @returns ProjectsPublic Successful Response
   * @throws ApiError
   */
  public static getProjects(
    data: ProjectsData["GetProjects"] = {},
  ): CancelablePromise<ProjectsPublic> {
    const { limit = 100, offset = 0, searchFor } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects",
      query: {
        limit,
        offset,
        search_for: searchFor,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Create Project
   * Create new project.
   * @returns ProjectPublic Successful Response
   * @throws ApiError
   */
  public static createProject(
    data: ProjectsData["CreateProject"],
  ): CancelablePromise<ProjectPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Owned Projects
   * @returns ProjectsPublic Successful Response
   * @throws ApiError
   */
  public static getOwnedProjects(
    data: ProjectsData["GetOwnedProjects"] = {},
  ): CancelablePromise<ProjectsPublic> {
    const { limit = 100, offset = 0, searchFor } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/projects",
      query: {
        limit,
        offset,
        search_for: searchFor,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project
   * @returns ProjectPublic Successful Response
   * @throws ApiError
   */
  public static getProject(
    data: ProjectsData["GetProject"],
  ): CancelablePromise<ProjectPublic> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Patch Project
   * @returns ProjectPublic Successful Response
   * @throws ApiError
   */
  public static patchProject(
    data: ProjectsData["PatchProject"],
  ): CancelablePromise<ProjectPublic> {
    const { ownerName, projectName, requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/projects/{owner_name}/{project_name}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Project
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteProject(
    data: ProjectsData["DeleteProject"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/projects/{owner_name}/{project_name}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Project By Id
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteProjectById(
    data: ProjectsData["DeleteProjectById"],
  ): CancelablePromise<Message> {
    const { projectId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/projects/{project_id}",
      path: {
        project_id: projectId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Git Repo
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectGitRepo(
    data: ProjectsData["GetProjectGitRepo"],
  ): CancelablePromise<unknown> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/git/repo",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Dvc File
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static postProjectDvcFile(
    data: ProjectsData["PostProjectDvcFile"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName, idx, md5, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/dvc/files/md5/{idx}/{md5}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        idx,
        md5,
      },
      query: {
        scope,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Dvc File
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectDvcFile(
    data: ProjectsData["GetProjectDvcFile"],
  ): CancelablePromise<unknown> {
    const { ownerName, projectName, idx, md5, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/dvc/files/md5/{idx}/{md5}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        idx,
        md5,
      },
      query: {
        scope,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Dvc Files
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectDvcFiles(
    data: ProjectsData["GetProjectDvcFiles"],
  ): CancelablePromise<unknown> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/dvc/files/md5",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Git Contents
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectGitContents(
    data: ProjectsData["GetProjectGitContents"],
  ): CancelablePromise<Array<GitItem> | GitItemWithContents | string> {
    const { ownerName, projectName, path, astype = "" } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/git/contents",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        path,
        astype,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Git Contents
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectGitContents1(
    data: ProjectsData["GetProjectGitContents1"],
  ): CancelablePromise<Array<GitItem> | GitItemWithContents | string> {
    const { ownerName, projectName, path, astype = "" } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/git/contents/{path}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        path,
      },
      query: {
        astype,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Contents
   * @returns ContentsItem Successful Response
   * @throws ApiError
   */
  public static getProjectContents(
    data: ProjectsData["GetProjectContents"],
  ): CancelablePromise<ContentsItem> {
    const { ownerName, projectName, path, ttl } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/contents",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        path,
        ttl,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Contents
   * @returns ContentsItem Successful Response
   * @throws ApiError
   */
  public static getProjectContents1(
    data: ProjectsData["GetProjectContents1"],
  ): CancelablePromise<ContentsItem> {
    const { ownerName, projectName, path, ttl } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/contents/{path}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        path,
      },
      query: {
        ttl,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Put Project Contents
   * @returns ContentsItem Successful Response
   * @throws ApiError
   */
  public static putProjectContents(
    data: ProjectsData["PutProjectContents"],
  ): CancelablePromise<ContentsItem> {
    const { ownerName, projectName, path, contentLength, formData } = data
    return __request(OpenAPI, {
      method: "PUT",
      url: "/projects/{owner_name}/{project_name}/contents/{path}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        path,
      },
      headers: {
        "content-length": contentLength,
      },
      formData: formData,
      mediaType: "multipart/form-data",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Patch Project Contents
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static patchProjectContents(
    data: ProjectsData["PatchProjectContents"],
  ): CancelablePromise<Record<string, unknown> | null> {
    const { ownerName, projectName, path, requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/projects/{owner_name}/{project_name}/contents/{path}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        path,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Questions
   * @returns Question Successful Response
   * @throws ApiError
   */
  public static getProjectQuestions(
    data: ProjectsData["GetProjectQuestions"],
  ): CancelablePromise<Array<Question>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/questions",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Question
   * @returns Question Successful Response
   * @throws ApiError
   */
  public static postProjectQuestion(
    data: ProjectsData["PostProjectQuestion"],
  ): CancelablePromise<Question> {
    const { ownerName, projectName, requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/questions",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Figures
   * @returns Figure Successful Response
   * @throws ApiError
   */
  public static getProjectFigures(
    data: ProjectsData["GetProjectFigures"],
  ): CancelablePromise<Array<Figure>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/figures",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Figure
   * @returns Figure Successful Response
   * @throws ApiError
   */
  public static postProjectFigure(
    data: ProjectsData["PostProjectFigure"],
  ): CancelablePromise<Figure> {
    const { ownerName, projectName, formData } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/figures",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      formData: formData,
      mediaType: "application/x-www-form-urlencoded",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Figure
   * @returns Figure Successful Response
   * @throws ApiError
   */
  public static getProjectFigure(
    data: ProjectsData["GetProjectFigure"],
  ): CancelablePromise<Figure> {
    const { ownerName, projectName, figurePath, ttl } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/figures/{figure_path}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        figure_path: figurePath,
      },
      query: {
        ttl,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Figure Comments
   * @returns FigureComment Successful Response
   * @throws ApiError
   */
  public static getFigureComments(
    data: ProjectsData["GetFigureComments"],
  ): CancelablePromise<Array<FigureComment>> {
    const { ownerName, projectName, figurePath } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/figure-comments",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        figure_path: figurePath,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Figure Comment
   * @returns FigureComment Successful Response
   * @throws ApiError
   */
  public static postFigureComment(
    data: ProjectsData["PostFigureComment"],
  ): CancelablePromise<FigureComment> {
    const { ownerName, projectName, requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/figure-comments",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Datasets
   * @returns Dataset Successful Response
   * @throws ApiError
   */
  public static getProjectDatasets(
    data: ProjectsData["GetProjectDatasets"],
  ): CancelablePromise<Array<Dataset>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/datasets",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Dataset
   * @returns DatasetDVCImport Successful Response
   * @throws ApiError
   */
  public static getProjectDataset(
    data: ProjectsData["GetProjectDataset"],
  ): CancelablePromise<DatasetDVCImport> {
    const { path, ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/datasets/{path}",
      path: {
        path,
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Dataset Label
   * @returns Dataset Successful Response
   * @throws ApiError
   */
  public static postProjectDatasetLabel(
    data: ProjectsData["PostProjectDatasetLabel"],
  ): CancelablePromise<Dataset> {
    const { ownerName, projectName, requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/datasets/label",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Dataset Upload
   * @returns Dataset Successful Response
   * @throws ApiError
   */
  public static postProjectDatasetUpload(
    data: ProjectsData["PostProjectDatasetUpload"],
  ): CancelablePromise<Dataset> {
    const { ownerName, projectName, contentLength, formData } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/datasets/upload",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      headers: {
        "content-length": contentLength,
      },
      formData: formData,
      mediaType: "multipart/form-data",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Publications
   * @returns Publication Successful Response
   * @throws ApiError
   */
  public static getProjectPublications(
    data: ProjectsData["GetProjectPublications"],
  ): CancelablePromise<Array<Publication>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/publications",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Publication
   * @returns Publication Successful Response
   * @throws ApiError
   */
  public static postProjectPublication(
    data: ProjectsData["PostProjectPublication"],
  ): CancelablePromise<Publication> {
    const { ownerName, projectName, formData } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/publications",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      formData: formData,
      mediaType: "application/x-www-form-urlencoded",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Sync
   * Synchronize a project with its Git repo.
   *
   * Do we actually need this? It will give us a way to operate if GitHub is
   * down, at least in read-only mode.
   * Or perhaps we can bidirectionally sync, allowing users to update Calkit
   * entities and we'll commit them back on sync.
   * It would probably be better to use Git for that, so we can handle
   * asynchronous edits with merges.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static postProjectSync(
    data: ProjectsData["PostProjectSync"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/syncs",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Pipeline
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectPipeline(
    data: ProjectsData["GetProjectPipeline"],
  ): CancelablePromise<Pipeline | null> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/pipeline",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Collaborators
   * @returns Collaborator Successful Response
   * @throws ApiError
   */
  public static getProjectCollaborators(
    data: ProjectsData["GetProjectCollaborators"],
  ): CancelablePromise<Array<Collaborator>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/collaborators",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Put Project Collaborator
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static putProjectCollaborator(
    data: ProjectsData["PutProjectCollaborator"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName, githubUsername } = data
    return __request(OpenAPI, {
      method: "PUT",
      url: "/projects/{owner_name}/{project_name}/collaborators/{github_username}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        github_username: githubUsername,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Project Collaborator
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteProjectCollaborator(
    data: ProjectsData["DeleteProjectCollaborator"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName, githubUsername } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/projects/{owner_name}/{project_name}/collaborators/{github_username}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        github_username: githubUsername,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Issues
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public static getProjectIssues(
    data: ProjectsData["GetProjectIssues"],
  ): CancelablePromise<Array<Issue>> {
    const {
      ownerName,
      projectName,
      page = 1,
      perPage = 30,
      state = "open",
    } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/issues",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        page,
        per_page: perPage,
        state,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Issue
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public static postProjectIssue(
    data: ProjectsData["PostProjectIssue"],
  ): CancelablePromise<Issue> {
    const { ownerName, projectName, requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/issues",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Patch Project Issue
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static patchProjectIssue(
    data: ProjectsData["PatchProjectIssue"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName, issueNumber, requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/projects/{owner_name}/{project_name}/issues/{issue_number}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        issue_number: issueNumber,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project References
   * @returns References Successful Response
   * @throws ApiError
   */
  public static getProjectReferences(
    data: ProjectsData["GetProjectReferences"],
  ): CancelablePromise<Array<References>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/references",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Environments
   * @returns Environment Successful Response
   * @throws ApiError
   */
  public static getProjectEnvironments(
    data: ProjectsData["GetProjectEnvironments"],
  ): CancelablePromise<Array<Environment>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/environments",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Software
   * @returns Software Successful Response
   * @throws ApiError
   */
  public static getProjectSoftware(
    data: ProjectsData["GetProjectSoftware"],
  ): CancelablePromise<Software> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/software",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project File Locks
   * @returns FileLock Successful Response
   * @throws ApiError
   */
  public static getProjectFileLocks(
    data: ProjectsData["GetProjectFileLocks"],
  ): CancelablePromise<Array<FileLock>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/file-locks",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project File Lock
   * @returns FileLock Successful Response
   * @throws ApiError
   */
  public static postProjectFileLock(
    data: ProjectsData["PostProjectFileLock"],
  ): CancelablePromise<FileLock> {
    const { ownerName, projectName, requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/file-locks",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Project File Lock
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteProjectFileLock(
    data: ProjectsData["DeleteProjectFileLock"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName, requestBody } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/projects/{owner_name}/{project_name}/file-locks",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Notebooks
   * @returns Notebook Successful Response
   * @throws ApiError
   */
  public static getProjectNotebooks(
    data: ProjectsData["GetProjectNotebooks"],
  ): CancelablePromise<Array<Notebook>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/notebooks",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Repro Check
   * @returns ReproCheck Successful Response
   * @throws ApiError
   */
  public static getProjectReproCheck(
    data: ProjectsData["GetProjectReproCheck"],
  ): CancelablePromise<ReproCheck> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/repro-check",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Put Project Dev Container
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static putProjectDevContainer(
    data: ProjectsData["PutProjectDevContainer"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "PUT",
      url: "/projects/{owner_name}/{project_name}/devcontainer",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project App
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectApp(
    data: ProjectsData["GetProjectApp"],
  ): CancelablePromise<ProjectApp | null> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/app",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Showcase
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectShowcase(
    data: ProjectsData["GetProjectShowcase"],
  ): CancelablePromise<Showcase | null> {
    const { ownerName, projectName, ttl } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/showcase",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        ttl,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Github Releases
   * @returns GitHubRelease Successful Response
   * @throws ApiError
   */
  public static getProjectGithubReleases(
    data: ProjectsData["GetProjectGithubReleases"],
  ): CancelablePromise<Array<GitHubRelease>> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/github-releases",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Project Github Release
   * @returns GitHubRelease Successful Response
   * @throws ApiError
   */
  public static postProjectGithubRelease(
    data: ProjectsData["PostProjectGithubRelease"],
  ): CancelablePromise<GitHubRelease> {
    const { ownerName, projectName, requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/github-releases",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export class OrgsService {
  /**
   * Get User Orgs
   * @returns OrgPublic Successful Response
   * @throws ApiError
   */
  public static getUserOrgs(): CancelablePromise<Array<OrgPublic>> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/orgs",
    })
  }

  /**
   * Post Org
   * @returns OrgPublic Successful Response
   * @throws ApiError
   */
  public static postOrg(
    data: OrgsData["PostOrg"],
  ): CancelablePromise<OrgPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/orgs",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Add Org Member
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static addOrgMember(
    data: OrgsData["AddOrgMember"],
  ): CancelablePromise<Message> {
    const { orgName, requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/orgs/{org_name}/members",
      path: {
        org_name: orgName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Post Org Subscription
   * @returns NewSubscriptionResponse Successful Response
   * @throws ApiError
   */
  public static postOrgSubscription(
    data: OrgsData["PostOrgSubscription"],
  ): CancelablePromise<NewSubscriptionResponse> {
    const { orgName, requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/orgs/{org_name}/subscription",
      path: {
        org_name: orgName,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Org Storage
   * @returns StorageUsage Successful Response
   * @throws ApiError
   */
  public static getOrgStorage(
    data: OrgsData["GetOrgStorage"],
  ): CancelablePromise<StorageUsage> {
    const { orgName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/orgs/{org_name}/storage",
      path: {
        org_name: orgName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export class DatasetsService {
  /**
   * Get Datasets
   * @returns DatasetsResponse Successful Response
   * @throws ApiError
   */
  public static getDatasets(
    data: DatasetsData["GetDatasets"] = {},
  ): CancelablePromise<DatasetsResponse> {
    const { limit = 100, offset = 0, includeImported = false } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/datasets",
      query: {
        limit,
        offset,
        include_imported: includeImported,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}
