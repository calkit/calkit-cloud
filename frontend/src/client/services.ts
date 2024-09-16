import type { CancelablePromise } from "./core/CancelablePromise"
import { OpenAPI } from "./core/OpenAPI"
import { request as __request } from "./core/request"

import type {
  Body_login_login_access_token,
  Message,
  NewPassword,
  Token,
  UserPublic,
  NewSubscriptionResponse,
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
  Body_projects_post_project_figure,
  Body_projects_put_project_contents,
  Collaborator,
  ContentPatch,
  ContentsItem,
  Dataset,
  Figure,
  FigureComment,
  FigureCommentPost,
  GitItem,
  GitItemWithContents,
  Issue,
  IssuePatch,
  IssuePost,
  ProjectCreate,
  ProjectPatch,
  ProjectPublic,
  ProjectsPublic,
  Publication,
  Question,
  QuestionPost,
  References,
  Software,
  Workflow,
  OrgMemberPost,
  OrgPost,
  OrgPublic,
  OrgSubscriptionUpdate,
} from "./models"

export type LoginData = {
  LoginAccessToken: {
    formData: Body_login_login_access_token
  }
  TestToken: {
    scope?: string | null
  }
  RecoverPassword: {
    email: string
  }
  ResetPassword: {
    requestBody: NewPassword
  }
  RecoverPasswordHtmlContent: {
    email: string
    scope?: string | null
  }
  LoginWithGithub: {
    code: string
  }
}

export type UsersData = {
  ReadUsers: {
    limit?: number
    scope?: string | null
    skip?: number
  }
  CreateUser: {
    requestBody: UserCreate
    scope?: string | null
  }
  UpdateCurrentUser: {
    requestBody: UserUpdateMe
    scope?: string | null
  }
  GetCurrentUser: {
    scope?: string | null
  }
  DeleteCurrentUser: {
    scope?: string | null
  }
  UpdateCurrentUserPassword: {
    requestBody: UpdatePassword
    scope?: string | null
  }
  RegisterUser: {
    requestBody: UserRegister
  }
  ReadUserById: {
    scope?: string | null
    userId: string
  }
  UpdateUser: {
    requestBody: UserUpdate
    scope?: string | null
    userId: string
  }
  DeleteUser: {
    scope?: string | null
    userId: string
  }
  GetUserGithubRepos: {
    page?: number
    perPage?: number
    scope?: string | null
  }
  PostUserSubscription: {
    requestBody: SubscriptionUpdate
    scope?: string | null
  }
  PutUserSubscription: {
    requestBody: SubscriptionUpdate
    scope?: string | null
  }
  GetUserTokens: {
    isActive?: boolean | null
    scope?: string | null
  }
  PostUserToken: {
    requestBody: TokenPost
    scope?: string | null
  }
  PatchUserToken: {
    requestBody: TokenPatch
    scope?: string | null
    tokenId: string
  }
}

export type MiscData = {
  TestEmail: {
    emailTo: string
    scope?: string | null
  }
  GetDiscountCode: {
    discountCode: string
    nUsers?: number
    scope?: string | null
  }
  PostDiscountCode: {
    requestBody: DiscountCodePost
    scope?: string | null
  }
}

export type ProjectsData = {
  GetOwnedProjects: {
    limit?: number
    offset?: number
    scope?: string | null
  }
  CreateProject: {
    requestBody: ProjectCreate
    scope?: string | null
  }
  GetProject: {
    projectId: string
    scope?: string | null
  }
  DeleteProjectById: {
    projectId: string
    scope?: string | null
  }
  GetProjectByName: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  PatchProject: {
    ownerName: string
    projectName: string
    requestBody: ProjectPatch
    scope?: string | null
  }
  DeleteProject: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectGitRepo: {
    ownerName: string
    projectName: string
    scope?: string | null
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
    scope?: string | null
  }
  GetProjectGitContents: {
    astype?: "" | ".raw" | ".html" | ".object"
    ownerName: string
    path?: string | null
    projectName: string
    scope?: string | null
  }
  GetProjectGitContents1: {
    astype?: "" | ".raw" | ".html" | ".object"
    ownerName: string
    path: string | null
    projectName: string
    scope?: string | null
  }
  GetProjectContents: {
    ownerName: string
    path?: string | null
    projectName: string
    scope?: string | null
    ttl?: number | null
  }
  GetProjectContents1: {
    ownerName: string
    path: string | null
    projectName: string
    scope?: string | null
    ttl?: number | null
  }
  PutProjectContents: {
    formData: Body_projects_put_project_contents
    ownerName: string
    path: string
    projectName: string
    scope?: string | null
  }
  PatchProjectContents: {
    ownerName: string
    path: string
    projectName: string
    requestBody: ContentPatch
    scope?: string | null
  }
  GetProjectQuestions: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  PostProjectQuestion: {
    ownerName: string
    projectName: string
    requestBody: QuestionPost
    scope?: string | null
  }
  GetProjectFigures: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  PostProjectFigure: {
    formData: Body_projects_post_project_figure
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectFigure: {
    figurePath: string
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetFigureComments: {
    figurePath?: string | null
    ownerName: string
    projectName: string
    scope?: string | null
  }
  PostFigureComment: {
    ownerName: string
    projectName: string
    requestBody: FigureCommentPost
    scope?: string | null
  }
  GetProjectData: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectPublications: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  PostProjectSync: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectWorkflow: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectCollaborators: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  PutProjectCollaborator: {
    githubUsername: string
    ownerName: string
    projectName: string
    scope?: string | null
  }
  DeleteProjectCollaborator: {
    githubUsername: string
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectIssues: {
    ownerName: string
    page?: number
    perPage?: number
    projectName: string
    scope?: string | null
    state?: "open" | "closed" | "all"
  }
  PostProjectIssue: {
    ownerName: string
    projectName: string
    requestBody: IssuePost
    scope?: string | null
  }
  PatchProjectIssue: {
    issueNumber: number
    ownerName: string
    projectName: string
    requestBody: IssuePatch
    scope?: string | null
  }
  GetProjectReferences: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
  GetProjectSoftware: {
    ownerName: string
    projectName: string
    scope?: string | null
  }
}

export type OrgsData = {
  GetUserOrgs: {
    scope?: string | null
  }
  PostOrg: {
    requestBody: OrgPost
    scope?: string | null
  }
  AddOrgMember: {
    orgName: string
    requestBody: OrgMemberPost
    scope?: string | null
  }
  PostOrgSubscription: {
    orgName: string
    requestBody: OrgSubscriptionUpdate
    scope?: string | null
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
  public static testToken(
    data: LoginData["TestToken"] = {},
  ): CancelablePromise<UserPublic> {
    const { scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/login/test-token",
      query: {
        scope,
      },
      errors: {
        422: `Validation Error`,
      },
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
    const { email, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/password-recovery-html-content/{email}",
      path: {
        email,
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
    const { skip = 0, limit = 100, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/users",
      query: {
        skip,
        limit,
        scope,
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/users",
      query: {
        scope,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/user",
      query: {
        scope,
      },
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
  public static getCurrentUser(
    data: UsersData["GetCurrentUser"] = {},
  ): CancelablePromise<UserPublic> {
    const { scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/user",
      query: {
        scope,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Current User
   * Delete own user.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteCurrentUser(
    data: UsersData["DeleteCurrentUser"] = {},
  ): CancelablePromise<Message> {
    const { scope } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/user",
      query: {
        scope,
      },
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/user/password",
      query: {
        scope,
      },
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
    const { userId, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/users/{user_id}",
      path: {
        user_id: userId,
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
   * Update User
   * Update a user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static updateUser(
    data: UsersData["UpdateUser"],
  ): CancelablePromise<UserPublic> {
    const { userId, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/users/{user_id}",
      path: {
        user_id: userId,
      },
      query: {
        scope,
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
    const { userId, scope } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/users/{user_id}",
      path: {
        user_id: userId,
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
   * Get User Github Repos
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getUserGithubRepos(
    data: UsersData["GetUserGithubRepos"] = {},
  ): CancelablePromise<Array<Record<string, unknown>>> {
    const { perPage = 30, page = 1, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/github/repos",
      query: {
        per_page: perPage,
        page,
        scope,
      },
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/user/subscription",
      query: {
        scope,
      },
      body: requestBody,
      mediaType: "application/json",
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "PUT",
      url: "/user/subscription",
      query: {
        scope,
      },
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
    const { isActive, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/tokens",
      query: {
        is_active: isActive,
        scope,
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/user/tokens",
      query: {
        scope,
      },
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
    const { tokenId, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/user/tokens/{token_id}",
      path: {
        token_id: tokenId,
      },
      query: {
        scope,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
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
    const { emailTo, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/test-email/",
      query: {
        email_to: emailTo,
        scope,
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
    const { discountCode, nUsers = 1, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/discount-codes/{discount_code}",
      path: {
        discount_code: discountCode,
      },
      query: {
        n_users: nUsers,
        scope,
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/discount-codes",
      query: {
        scope,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export class ProjectsService {
  /**
   * Get Owned Projects
   * @returns ProjectsPublic Successful Response
   * @throws ApiError
   */
  public static getOwnedProjects(
    data: ProjectsData["GetOwnedProjects"] = {},
  ): CancelablePromise<ProjectsPublic> {
    const { limit = 100, offset = 0, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/owned",
      query: {
        limit,
        offset,
        scope,
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects",
      query: {
        scope,
      },
      body: requestBody,
      mediaType: "application/json",
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
    const { projectId, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{project_id}",
      path: {
        project_id: projectId,
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
   * Delete Project By Id
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteProjectById(
    data: ProjectsData["DeleteProjectById"],
  ): CancelablePromise<Message> {
    const { projectId, scope } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/projects/{project_id}",
      path: {
        project_id: projectId,
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
   * Get Project By Name
   * @returns ProjectPublic Successful Response
   * @throws ApiError
   */
  public static getProjectByName(
    data: ProjectsData["GetProjectByName"],
  ): CancelablePromise<ProjectPublic> {
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Patch Project
   * @returns ProjectPublic Successful Response
   * @throws ApiError
   */
  public static patchProject(
    data: ProjectsData["PatchProject"],
  ): CancelablePromise<ProjectPublic> {
    const { ownerName, projectName, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/projects/{owner_name}/{project_name}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        scope,
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
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/projects/{owner_name}/{project_name}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Get Project Git Repo
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectGitRepo(
    data: ProjectsData["GetProjectGitRepo"],
  ): CancelablePromise<unknown> {
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/git/repo",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/dvc/files/md5",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Get Project Git Contents
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectGitContents(
    data: ProjectsData["GetProjectGitContents"],
  ): CancelablePromise<Array<GitItem> | GitItemWithContents | string> {
    const { ownerName, projectName, path, astype = "", scope } = data
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
        scope,
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
    const { ownerName, projectName, path, astype = "", scope } = data
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
        scope,
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
    const { ownerName, projectName, path, ttl, scope } = data
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
        scope,
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
    const { ownerName, projectName, path, ttl, scope } = data
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
        scope,
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
    const { ownerName, projectName, path, formData, scope } = data
    return __request(OpenAPI, {
      method: "PUT",
      url: "/projects/{owner_name}/{project_name}/contents/{path}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        path,
      },
      query: {
        scope,
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
    const { ownerName, projectName, path, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/projects/{owner_name}/{project_name}/contents/{path}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        path,
      },
      query: {
        scope,
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
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/questions",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Post Project Question
   * @returns Question Successful Response
   * @throws ApiError
   */
  public static postProjectQuestion(
    data: ProjectsData["PostProjectQuestion"],
  ): CancelablePromise<Question> {
    const { ownerName, projectName, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/questions",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        scope,
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
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/figures",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Post Project Figure
   * @returns Figure Successful Response
   * @throws ApiError
   */
  public static postProjectFigure(
    data: ProjectsData["PostProjectFigure"],
  ): CancelablePromise<Figure> {
    const { ownerName, projectName, formData, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/figures",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        scope,
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
    const { ownerName, projectName, figurePath, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/figures/{figure_path}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        figure_path: figurePath,
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
   * Get Figure Comments
   * @returns FigureComment Successful Response
   * @throws ApiError
   */
  public static getFigureComments(
    data: ProjectsData["GetFigureComments"],
  ): CancelablePromise<Array<FigureComment>> {
    const { ownerName, projectName, figurePath, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/figure-comments",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        figure_path: figurePath,
        scope,
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
    const { ownerName, projectName, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/figure-comments",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        scope,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project Data
   * @returns Dataset Successful Response
   * @throws ApiError
   */
  public static getProjectData(
    data: ProjectsData["GetProjectData"],
  ): CancelablePromise<Array<Dataset>> {
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/data",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Get Project Publications
   * @returns Publication Successful Response
   * @throws ApiError
   */
  public static getProjectPublications(
    data: ProjectsData["GetProjectPublications"],
  ): CancelablePromise<Array<Publication>> {
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/publications",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/syncs",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Get Project Workflow
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static getProjectWorkflow(
    data: ProjectsData["GetProjectWorkflow"],
  ): CancelablePromise<Workflow | null> {
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/workflow",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Get Project Collaborators
   * @returns Collaborator Successful Response
   * @throws ApiError
   */
  public static getProjectCollaborators(
    data: ProjectsData["GetProjectCollaborators"],
  ): CancelablePromise<Array<Collaborator>> {
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/collaborators",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Put Project Collaborator
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static putProjectCollaborator(
    data: ProjectsData["PutProjectCollaborator"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName, githubUsername, scope } = data
    return __request(OpenAPI, {
      method: "PUT",
      url: "/projects/{owner_name}/{project_name}/collaborators/{github_username}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        github_username: githubUsername,
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
   * Delete Project Collaborator
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteProjectCollaborator(
    data: ProjectsData["DeleteProjectCollaborator"],
  ): CancelablePromise<Message> {
    const { ownerName, projectName, githubUsername, scope } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/projects/{owner_name}/{project_name}/collaborators/{github_username}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        github_username: githubUsername,
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
      scope,
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
        scope,
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
    const { ownerName, projectName, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/projects/{owner_name}/{project_name}/issues",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        scope,
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
    const { ownerName, projectName, issueNumber, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/projects/{owner_name}/{project_name}/issues/{issue_number}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        issue_number: issueNumber,
      },
      query: {
        scope,
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
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/references",
      path: {
        owner_name: ownerName,
        project_name: projectName,
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
   * Get Project Software
   * @returns Software Successful Response
   * @throws ApiError
   */
  public static getProjectSoftware(
    data: ProjectsData["GetProjectSoftware"],
  ): CancelablePromise<Software> {
    const { ownerName, projectName, scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/projects/{owner_name}/{project_name}/software",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      query: {
        scope,
      },
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
  public static getUserOrgs(
    data: OrgsData["GetUserOrgs"] = {},
  ): CancelablePromise<Array<OrgPublic>> {
    const { scope } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/user/orgs",
      query: {
        scope,
      },
      errors: {
        422: `Validation Error`,
      },
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
    const { requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/orgs",
      query: {
        scope,
      },
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
    const { orgName, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/orgs/{org_name}/members",
      path: {
        org_name: orgName,
      },
      query: {
        scope,
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
    const { orgName, requestBody, scope } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/orgs/{org_name}/subscription",
      path: {
        org_name: orgName,
      },
      query: {
        scope,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }
}
