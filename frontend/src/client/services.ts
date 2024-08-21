import type { CancelablePromise } from "./core/CancelablePromise"
import { OpenAPI } from "./core/OpenAPI"
import { request as __request } from "./core/request"

import type {
  Body_login_login_access_token,
  Message,
  NewPassword,
  Token,
  UserPublic,
  UpdatePassword,
  UserCreate,
  UserRegister,
  UsersPublic,
  UserUpdate,
  UserUpdateMe,
  ItemCreate,
  ItemPublic,
  ItemsPublic,
  ItemUpdate,
  Dataset,
  Figure,
  GitItem,
  GitItemWithContents,
  Project,
  ProjectCreate,
  ProjectsPublic,
  Question,
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
}

export type MiscData = {
  TestEmail: {
    emailTo: string
  }
}

export type ItemsData = {
  ReadItems: {
    limit?: number
    skip?: number
  }
  CreateItem: {
    requestBody: ItemCreate
  }
  ReadItem: {
    id: string
  }
  UpdateItem: {
    id: string
    requestBody: ItemUpdate
  }
  DeleteItem: {
    id: string
  }
}

export type ProjectsData = {
  GetOwnedProjects: {
    limit?: number
    offset?: number
  }
  CreateProject: {
    requestBody: ProjectCreate
  }
  GetProject: {
    projectId: string
  }
  GetProjectByName: {
    ownerName: string
    projectName: string
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
  }
  GetProjectDvcFile: {
    idx: string
    md5: string
    ownerName: string
    projectName: string
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
  GetProjectQuestions: {
    ownerName: string
    projectName: string
  }
  GetProjectFigures: {
    ownerName: string
    projectName: string
  }
  GetProjectDatasets: {
    ownerName: string
    projectName: string
  }
  PostProjectSync: {
    ownerName: string
    projectName: string
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
      url: "/api/v1/login/access-token",
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
      url: "/api/v1/login/test-token",
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
      url: "/api/v1/password-recovery/{email}",
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
      url: "/api/v1/reset-password/",
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
      url: "/api/v1/password-recovery-html-content/{email}",
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
      url: "/api/v1/login/github",
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
      url: "/api/v1/users",
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
      url: "/api/v1/users",
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
      url: "/api/v1/user",
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
      url: "/api/v1/user",
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
      url: "/api/v1/user",
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
      url: "/api/v1/user/password",
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
      url: "/api/v1/users/signup",
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
      url: "/api/v1/users/{user_id}",
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
      url: "/api/v1/users/{user_id}",
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
      url: "/api/v1/users/{user_id}",
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
      url: "/api/v1/user/github/repos",
      query: {
        per_page: perPage,
        page,
      },
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
    const { emailTo } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/test-email/",
      query: {
        email_to: emailTo,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export class ItemsService {
  /**
   * Read Items
   * Retrieve items.
   * @returns ItemsPublic Successful Response
   * @throws ApiError
   */
  public static readItems(
    data: ItemsData["ReadItems"] = {},
  ): CancelablePromise<ItemsPublic> {
    const { skip = 0, limit = 100 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/items/",
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
   * Create Item
   * Create new item.
   * @returns ItemPublic Successful Response
   * @throws ApiError
   */
  public static createItem(
    data: ItemsData["CreateItem"],
  ): CancelablePromise<ItemPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/items/",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Item
   * Get item by ID.
   * @returns ItemPublic Successful Response
   * @throws ApiError
   */
  public static readItem(
    data: ItemsData["ReadItem"],
  ): CancelablePromise<ItemPublic> {
    const { id } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/items/{id}",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Item
   * Update an item.
   * @returns ItemPublic Successful Response
   * @throws ApiError
   */
  public static updateItem(
    data: ItemsData["UpdateItem"],
  ): CancelablePromise<ItemPublic> {
    const { id, requestBody } = data
    return __request(OpenAPI, {
      method: "PUT",
      url: "/api/v1/items/{id}",
      path: {
        id,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Item
   * Delete an item.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteItem(
    data: ItemsData["DeleteItem"],
  ): CancelablePromise<Message> {
    const { id } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/items/{id}",
      path: {
        id,
      },
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
    const { limit = 100, offset = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/projects/owned",
      query: {
        limit,
        offset,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Create Project
   * Create new project.
   * @returns Project Successful Response
   * @throws ApiError
   */
  public static createProject(
    data: ProjectsData["CreateProject"],
  ): CancelablePromise<Project> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/projects",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project
   * @returns Project Successful Response
   * @throws ApiError
   */
  public static getProject(
    data: ProjectsData["GetProject"],
  ): CancelablePromise<Project> {
    const { projectId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/projects/{project_id}",
      path: {
        project_id: projectId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Project By Name
   * @returns Project Successful Response
   * @throws ApiError
   */
  public static getProjectByName(
    data: ProjectsData["GetProjectByName"],
  ): CancelablePromise<Project> {
    const { ownerName, projectName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/projects/{owner_name}/{project_name}",
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
      url: "/api/v1/projects/{owner_name}/{project_name}/git/repo",
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
    const { ownerName, projectName, idx, md5 } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/projects/{owner_name}/{project_name}/dvc/files/md5/{idx}/{md5}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        idx,
        md5,
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
    const { ownerName, projectName, idx, md5 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/projects/{owner_name}/{project_name}/dvc/files/md5/{idx}/{md5}",
      path: {
        owner_name: ownerName,
        project_name: projectName,
        idx,
        md5,
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
      url: "/api/v1/projects/{owner_name}/{project_name}/dvc/files/md5",
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
      url: "/api/v1/projects/{owner_name}/{project_name}/git/contents",
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
      url: "/api/v1/projects/{owner_name}/{project_name}/git/contents/{path}",
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
      url: "/api/v1/projects/{owner_name}/{project_name}/questions",
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
      url: "/api/v1/projects/{owner_name}/{project_name}/figures",
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
      url: "/api/v1/projects/{owner_name}/{project_name}/datasets",
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
      url: "/api/v1/projects/{owner_name}/{project_name}/syncs",
      path: {
        owner_name: ownerName,
        project_name: projectName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}
