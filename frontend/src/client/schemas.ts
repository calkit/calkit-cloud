export const $Body_login_login_access_token = {
  properties: {
    grant_type: {
      type: "any-of",
      contains: [
        {
          type: "string",
          pattern: "password",
        },
        {
          type: "null",
        },
      ],
    },
    username: {
      type: "string",
      isRequired: true,
    },
    password: {
      type: "string",
      isRequired: true,
    },
    scope: {
      type: "string",
      default: "",
    },
    client_id: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    client_secret: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $Dataset = {
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
    project_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    path: {
      type: "string",
      isRequired: true,
    },
    tabular: {
      type: "boolean",
      isRequired: true,
    },
    pipeline: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    description: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $Figure = {
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
    project_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    path: {
      type: "string",
      isRequired: true,
    },
    title: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    pipeline: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
  },
} as const

export const $GitItem = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    path: {
      type: "string",
      isRequired: true,
    },
    sha: {
      type: "string",
      isRequired: true,
    },
    size: {
      type: "number",
      isRequired: true,
    },
    url: {
      type: "string",
      isRequired: true,
    },
    html_url: {
      type: "string",
      isRequired: true,
    },
    git_url: {
      type: "string",
      isRequired: true,
    },
    download_url: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    type: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $GitItemWithContents = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    path: {
      type: "string",
      isRequired: true,
    },
    sha: {
      type: "string",
      isRequired: true,
    },
    size: {
      type: "number",
      isRequired: true,
    },
    url: {
      type: "string",
      isRequired: true,
    },
    html_url: {
      type: "string",
      isRequired: true,
    },
    git_url: {
      type: "string",
      isRequired: true,
    },
    download_url: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    type: {
      type: "string",
      isRequired: true,
    },
    encoding: {
      type: "string",
      isRequired: true,
    },
    content: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $HTTPValidationError = {
  properties: {
    detail: {
      type: "array",
      contains: {
        type: "ValidationError",
      },
    },
  },
} as const

export const $ItemCreate = {
  properties: {
    title: {
      type: "string",
      isRequired: true,
      maxLength: 255,
      minLength: 1,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $ItemPublic = {
  properties: {
    title: {
      type: "string",
      isRequired: true,
      maxLength: 255,
      minLength: 1,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $ItemUpdate = {
  properties: {
    title: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
          minLength: 1,
        },
        {
          type: "null",
        },
      ],
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $ItemsPublic = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "ItemPublic",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $Message = {
  properties: {
    message: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $NewPassword = {
  properties: {
    token: {
      type: "string",
      isRequired: true,
    },
    new_password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
  },
} as const

export const $Project = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
      maxLength: 255,
      minLength: 4,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 2048,
          minLength: 0,
        },
        {
          type: "null",
        },
      ],
    },
    git_repo_url: {
      type: "string",
      isRequired: true,
      maxLength: 2048,
    },
    is_public: {
      type: "boolean",
      default: false,
    },
    id: {
      type: "string",
      format: "uuid",
    },
    owner_user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_github_username: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
  },
} as const

export const $ProjectCreate = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
      maxLength: 255,
      minLength: 4,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 2048,
          minLength: 0,
        },
        {
          type: "null",
        },
      ],
    },
    git_repo_url: {
      type: "string",
      isRequired: true,
      maxLength: 2048,
    },
    is_public: {
      type: "boolean",
      default: false,
    },
  },
} as const

export const $ProjectPublic = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
      maxLength: 255,
      minLength: 4,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 2048,
          minLength: 0,
        },
        {
          type: "null",
        },
      ],
    },
    git_repo_url: {
      type: "string",
      isRequired: true,
      maxLength: 2048,
    },
    is_public: {
      type: "boolean",
      default: false,
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_github_username: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    name_slug: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
  },
} as const

export const $ProjectsPublic = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "ProjectPublic",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $Question = {
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
    project_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    question: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $Token = {
  properties: {
    access_token: {
      type: "string",
      isRequired: true,
    },
    token_type: {
      type: "string",
      default: "bearer",
    },
  },
} as const

export const $UpdatePassword = {
  properties: {
    current_password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
    new_password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
  },
} as const

export const $UserCreate = {
  properties: {
    email: {
      type: "string",
      isRequired: true,
      format: "email",
      maxLength: 255,
    },
    is_active: {
      type: "boolean",
      default: true,
    },
    is_superuser: {
      type: "boolean",
      default: false,
    },
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    github_username: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
  },
} as const

export const $UserPublic = {
  properties: {
    email: {
      type: "string",
      isRequired: true,
      format: "email",
      maxLength: 255,
    },
    is_active: {
      type: "boolean",
      default: true,
    },
    is_superuser: {
      type: "boolean",
      default: false,
    },
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    github_username: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $UserRegister = {
  properties: {
    email: {
      type: "string",
      isRequired: true,
      format: "email",
      maxLength: 255,
    },
    password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $UserUpdate = {
  properties: {
    email: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "email",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    is_active: {
      type: "boolean",
      default: true,
    },
    is_superuser: {
      type: "boolean",
      default: false,
    },
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    github_username: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    password: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 40,
          minLength: 8,
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $UserUpdateMe = {
  properties: {
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    email: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "email",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    github_username: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $UsersPublic = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "UserPublic",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $ValidationError = {
  properties: {
    loc: {
      type: "array",
      contains: {
        type: "any-of",
        contains: [
          {
            type: "string",
          },
          {
            type: "number",
          },
        ],
      },
      isRequired: true,
    },
    msg: {
      type: "string",
      isRequired: true,
    },
    type: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $Workflow = {
  properties: {
    mermaid: {
      type: "string",
      isRequired: true,
    },
    stages: {
      type: "dictionary",
      contains: {
        type: "WorkflowStage",
      },
      isRequired: true,
    },
  },
} as const

export const $WorkflowStage = {
  properties: {
    cmd: {
      type: "string",
      isRequired: true,
    },
    deps: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "string",
          },
        },
        {
          type: "null",
        },
      ],
    },
    outs: {
      type: "array",
      contains: {
        type: "string",
      },
      isRequired: true,
    },
    desc: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    meta: {
      type: "any-of",
      contains: [
        {
          type: "dictionary",
          contains: {
            properties: {},
          },
        },
        {
          type: "null",
        },
      ],
    },
    wdir: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const
