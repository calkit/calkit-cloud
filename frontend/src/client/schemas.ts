export const $Body_login_login_access_token = {
  properties: {
    grant_type: {
      type: "any-of",
      contains: [
        {
          type: "string",
          pattern: "^password$",
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
      format: "password",
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

export const $Body_projects_post_project_dataset_upload = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    title: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "string",
      isRequired: true,
    },
    file: {
      type: "binary",
      isRequired: true,
      format: "binary",
    },
  },
} as const

export const $Body_projects_post_project_figure = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    title: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "string",
      isRequired: true,
    },
    stage: {
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
    file: {
      type: "any-of",
      contains: [
        {
          type: "binary",
          format: "binary",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $Body_projects_post_project_publication = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    kind: {
      type: "Enum",
      enum: [
        "journal-article",
        "conference-paper",
        "presentation",
        "poster",
        "report",
        "book",
      ],
      isRequired: true,
    },
    title: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "string",
      isRequired: true,
    },
    stage: {
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
    template: {
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
    environment: {
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
    file: {
      type: "any-of",
      contains: [
        {
          type: "binary",
          format: "binary",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $Body_projects_put_project_contents = {
  properties: {
    file: {
      type: "binary",
      isRequired: true,
      format: "binary",
    },
  },
} as const

export const $Collaborator = {
  properties: {
    user_id: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "uuid",
        },
        {
          type: "null",
        },
      ],
    },
    github_username: {
      type: "string",
      isRequired: true,
    },
    full_name: {
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
    email: {
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
    access_level: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $ConnectedAccounts = {
  properties: {
    github: {
      type: "boolean",
      isRequired: true,
    },
    zenodo: {
      type: "boolean",
      isRequired: true,
    },
  },
} as const

export const $ContentPatch = {
  properties: {
    kind: {
      type: "any-of",
      contains: [
        {
          type: "Enum",
          enum: [
            "figure",
            "dataset",
            "publication",
            "environment",
            "references",
          ],
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    attrs: {
      type: "dictionary",
      contains: {
        properties: {},
      },
      default: {},
    },
  },
} as const

export const $ContentsItem = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    path: {
      type: "string",
      isRequired: true,
    },
    type: {
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
    size: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    in_repo: {
      type: "boolean",
      isRequired: true,
    },
    content: {
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
    url: {
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
    calkit_object: {
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
    lock: {
      type: "any-of",
      contains: [
        {
          type: "ItemLock",
        },
        {
          type: "null",
        },
      ],
    },
    dir_items: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "_ContentsItemBase",
          },
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $DVCImport = {
  description: `The necessary information to import a DVC object, which can be saved to
a .dvc file.

For example:

    outs:
      - md5: 46ce259ab949ecb23751eb88ec753ff2
        size: 83344240
        hash: md5
        path: time-ave-profiles.h5
        remote: calkit:petebachant/boundary-layer-turbulence-modeling
        push: false

Note this is different from the file that would be produced by
\`\`dvc import\`\`, since they bundle in Git repo information to fetch from
the original project's remote.`,
  properties: {
    outs: {
      type: "array",
      contains: {
        type: "DVCOut",
      },
      isRequired: true,
    },
  },
} as const

export const $DVCOut = {
  properties: {
    md5: {
      type: "string",
      isRequired: true,
    },
    size: {
      type: "number",
      isRequired: true,
    },
    hash: {
      type: "string",
      default: "md5",
    },
    path: {
      type: "string",
      isRequired: true,
    },
    remote: {
      type: "string",
      isRequired: true,
    },
    push: {
      type: "boolean",
      default: false,
    },
  },
} as const

export const $Dataset = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    imported_from: {
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
    title: {
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
    tabular: {
      type: "any-of",
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
    stage: {
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
    url: {
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
    id: {
      type: "string",
      format: "uuid",
    },
    project_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $DatasetForImport = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    imported_from: {
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
    title: {
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
    tabular: {
      type: "any-of",
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
    stage: {
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
    url: {
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
    dvc_import: {
      type: "any-of",
      contains: [
        {
          type: "DVCImport",
        },
        {
          type: "null",
        },
      ],
    },
    git_import: {
      type: "any-of",
      contains: [
        {
          type: "GitImport",
        },
        {
          type: "null",
        },
      ],
    },
    git_rev: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $DatasetResponse = {
  properties: {
    project: {
      type: "ProjectPublic",
      isRequired: true,
    },
    path: {
      type: "string",
      isRequired: true,
    },
    title: {
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
    imported_from: {
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

export const $DatasetsResponse = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "DatasetResponse",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $DiscountCode = {
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
    created: {
      type: "string",
      format: "date-time",
    },
    created_by_user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    created_for_account_id: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "uuid",
        },
        {
          type: "null",
        },
      ],
    },
    valid_from: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    valid_until: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    plan_id: {
      type: "number",
      isRequired: true,
      maximum: 2,
      minimum: 0,
    },
    price: {
      type: "number",
      isRequired: true,
    },
    months: {
      type: "number",
      isRequired: true,
    },
    n_users: {
      type: "number",
      default: 1,
    },
    redeemed: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    redeemed_by_user_id: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "uuid",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $DiscountCodePost = {
  properties: {
    valid_from: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    valid_until: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    created_for_account_name: {
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
    n_users: {
      type: "number",
      default: 1,
    },
    plan_name: {
      type: "Enum",
      enum: ["standard", "professional"],
      isRequired: true,
    },
    price: {
      type: "number",
      isRequired: true,
    },
    months: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $DiscountCodePublic = {
  properties: {
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    is_valid: {
      type: "boolean",
      default: true,
    },
    reason: {
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
    n_users: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
    },
    price: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
    },
    months: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
    },
    plan_name: {
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

export const $Environment = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    kind: {
      type: "string",
      isRequired: true,
    },
    path: {
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
    imported_from: {
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
    all_attrs: {
      type: "dictionary",
      contains: {
        properties: {},
      },
      isRequired: true,
    },
    file_content: {
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

export const $ExternalTokenResponse = {
  properties: {
    access_token: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $Figure = {
  properties: {
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
    },
    stage: {
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
    dataset: {
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
    content: {
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
    url: {
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

export const $FigureComment = {
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
    figure_path: {
      type: "string",
      isRequired: true,
      maxLength: 255,
    },
    user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    created: {
      type: "string",
      format: "date-time",
    },
    updated: {
      type: "string",
      format: "date-time",
    },
    external_url: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 2048,
        },
        {
          type: "null",
        },
      ],
    },
    comment: {
      type: "string",
      isRequired: true,
    },
    user_github_username: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
    user_full_name: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
    user_email: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
  },
} as const

export const $FigureCommentPost = {
  properties: {
    figure_path: {
      type: "string",
      isRequired: true,
    },
    comment: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $FileLock = {
  properties: {
    project_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    path: {
      type: "string",
      isRequired: true,
    },
    created: {
      type: "string",
      format: "date-time",
    },
    user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    user_github_username: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
    user_email: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
  },
} as const

export const $FileLockPost = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $ForeachStage = {
  properties: {
    foreach: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "string",
          },
        },
        {
          type: "string",
        },
      ],
      isRequired: true,
    },
    do: {
      type: "PipelineStage",
      isRequired: true,
    },
  },
} as const

export const $GitHubInstallations = {
  properties: {
    total_count: {
      type: "number",
      isRequired: true,
    },
    installations: {
      type: "array",
      contains: {
        type: "dictionary",
        contains: {
          properties: {},
        },
      },
      isRequired: true,
    },
  },
} as const

export const $GitHubRelease = {
  properties: {
    url: {
      type: "string",
      isRequired: true,
    },
    name: {
      type: "string",
      isRequired: true,
    },
    tag_name: {
      type: "string",
      isRequired: true,
    },
    body: {
      type: "string",
      isRequired: true,
    },
    created: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
    published: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
  },
} as const

export const $GitHubReleasePost = {
  properties: {
    tag_name: {
      type: "string",
      isRequired: true,
    },
    target_committish: {
      type: "string",
      default: "main",
    },
    name: {
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
    body: {
      type: "string",
      isRequired: true,
    },
    generate_release_notes: {
      type: "boolean",
      default: true,
    },
  },
} as const

export const $GitImport = {
  properties: {
    files: {
      type: "array",
      contains: {
        type: "string",
      },
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

export const $ImportInfo = {
  properties: {
    project_owner: {
      type: "string",
      isRequired: true,
    },
    project_name: {
      type: "string",
      isRequired: true,
    },
    git_rev: {
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
    path: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $Issue = {
  properties: {
    id: {
      type: "number",
      isRequired: true,
    },
    number: {
      type: "number",
      isRequired: true,
    },
    url: {
      type: "string",
      isRequired: true,
    },
    user_github_username: {
      type: "string",
      isRequired: true,
    },
    state: {
      type: "Enum",
      enum: ["open", "closed"],
      isRequired: true,
    },
    title: {
      type: "string",
      isRequired: true,
    },
    body: {
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

export const $IssuePatch = {
  properties: {
    state: {
      type: "Enum",
      enum: ["open", "closed"],
      isRequired: true,
    },
  },
} as const

export const $IssuePost = {
  properties: {
    title: {
      type: "string",
      isRequired: true,
    },
    body: {
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

export const $ItemLock = {
  properties: {
    created: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
    user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    user_email: {
      type: "string",
      isRequired: true,
    },
    user_github_username: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $LabelDatasetPost = {
  properties: {
    imported_from: {
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
    path: {
      type: "string",
      isRequired: true,
    },
    title: {
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
    tabular: {
      type: "any-of",
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
    stage: {
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

export const $NewSubscriptionResponse = {
  properties: {
    subscription: {
      type: "any-of",
      contains: [
        {
          type: "UserSubscription",
        },
        {
          type: "OrgSubscription",
        },
      ],
      isRequired: true,
    },
    stripe_session_client_secret: {
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

export const $Notebook = {
  properties: {
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
    },
    stage: {
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
    output_format: {
      type: "any-of",
      contains: [
        {
          type: "Enum",
          enum: ["html", "notebook"],
        },
        {
          type: "null",
        },
      ],
    },
    url: {
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
    content: {
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

export const $OrgMemberPost = {
  properties: {
    username: {
      type: "string",
      isRequired: true,
    },
    role: {
      type: "Enum",
      enum: ["read", "write", "admin", "owner"],
      isRequired: true,
    },
  },
} as const

export const $OrgPost = {
  properties: {
    name: {
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
    display_name: {
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
    github_name: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $OrgPublic = {
  properties: {
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    name: {
      type: "string",
      isRequired: true,
    },
    display_name: {
      type: "string",
      isRequired: true,
    },
    github_name: {
      type: "string",
      isRequired: true,
    },
    role: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $OrgSubscription = {
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
    created: {
      type: "string",
      format: "date-time",
    },
    period_months: {
      type: "number",
      isRequired: true,
    },
    price: {
      type: "number",
      isRequired: true,
    },
    paid_until: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    plan_id: {
      type: "number",
      isRequired: true,
      maximum: 2,
      minimum: 0,
    },
    is_active: {
      type: "boolean",
      default: true,
    },
    processor: {
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
    processor_product_id: {
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
    processor_price_id: {
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
    processor_subscription_id: {
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
    org_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    n_users: {
      type: "number",
      isRequired: true,
      minimum: 1,
    },
    subscriber_user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    plan_name: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
  },
} as const

export const $OrgSubscriptionUpdate = {
  properties: {
    plan_name: {
      type: "Enum",
      enum: ["standard", "professional"],
      isRequired: true,
    },
    period: {
      type: "Enum",
      enum: ["monthly", "annual"],
      isRequired: true,
    },
    discount_code: {
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
    n_users: {
      type: "number",
      isRequired: true,
      minimum: 2,
    },
  },
} as const

export const $Pipeline = {
  properties: {
    mermaid: {
      type: "string",
      isRequired: true,
    },
    stages: {
      type: "dictionary",
      contains: {
        type: "any-of",
        contains: [
          {
            type: "PipelineStage",
          },
          {
            type: "ForeachStage",
          },
        ],
      },
      isRequired: true,
    },
    yaml: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $PipelineStage = {
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
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "any-of",
            contains: [
              {
                type: "string",
              },
              {
                type: "dictionary",
                contains: {
                  type: "dictionary",
                  contains: {
                    properties: {},
                  },
                },
              },
            ],
          },
        },
        {
          type: "null",
        },
      ],
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

export const $ProjectApp = {
  properties: {
    path: {
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
    url: {
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
    title: {
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

export const $ProjectCreate = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
      maxLength: 255,
      minLength: 4,
    },
    title: {
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
    is_public: {
      type: "boolean",
      default: false,
    },
    created: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    updated: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    git_repo_url: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 2048,
        },
        {
          type: "null",
        },
      ],
    },
    latest_git_rev: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 40,
        },
        {
          type: "null",
        },
      ],
    },
    status: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 32,
          minLength: 4,
        },
        {
          type: "null",
        },
      ],
    },
    status_updated: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    status_message: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 2048,
        },
        {
          type: "null",
        },
      ],
    },
    template: {
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

export const $ProjectOptionalExtended = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
      maxLength: 255,
      minLength: 4,
    },
    title: {
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
    is_public: {
      type: "boolean",
      default: false,
    },
    created: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    updated: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
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
    latest_git_rev: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 40,
        },
        {
          type: "null",
        },
      ],
    },
    status: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 32,
          minLength: 4,
        },
        {
          type: "null",
        },
      ],
    },
    status_updated: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    status_message: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 2048,
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
    owner_account_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_account_name: {
      type: "string",
      isRequired: true,
    },
    owner_account_type: {
      type: "string",
      isRequired: true,
    },
    current_user_access: {
      type: "any-of",
      contains: [
        {
          type: "Enum",
          enum: ["read", "write", "admin", "owner"],
        },
        {
          type: "null",
        },
      ],
    },
    calkit_info_keys: {
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
    readme_content: {
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

export const $ProjectPatch = {
  properties: {
    title: {
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
    is_public: {
      type: "any-of",
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
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
    title: {
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
    is_public: {
      type: "boolean",
      default: false,
    },
    created: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    updated: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
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
    latest_git_rev: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 40,
        },
        {
          type: "null",
        },
      ],
    },
    status: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 32,
          minLength: 4,
        },
        {
          type: "null",
        },
      ],
    },
    status_updated: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    status_message: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 2048,
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
    owner_account_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_account_name: {
      type: "string",
      isRequired: true,
    },
    owner_account_type: {
      type: "string",
      isRequired: true,
    },
    current_user_access: {
      type: "any-of",
      contains: [
        {
          type: "Enum",
          enum: ["read", "write", "admin", "owner"],
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $ProjectStatus = {
  properties: {
    timestamp: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
    status: {
      type: "Enum",
      enum: ["in-progress", "on-hold", "completed"],
      isRequired: true,
    },
    message: {
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

export const $ProjectStatusPost = {
  properties: {
    status: {
      type: "Enum",
      enum: ["in-progress", "on-hold", "completed"],
      isRequired: true,
    },
    message: {
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

export const $Publication = {
  properties: {
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
    },
    type: {
      type: "any-of",
      contains: [
        {
          type: "Enum",
          enum: [
            "journal-article",
            "conference-paper",
            "presentation",
            "poster",
            "report",
            "book",
          ],
        },
        {
          type: "null",
        },
      ],
    },
    stage: {
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
    content: {
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
    stage_info: {
      type: "any-of",
      contains: [
        {
          type: "PipelineStage",
        },
        {
          type: "null",
        },
      ],
    },
    url: {
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
    number: {
      type: "number",
      isRequired: true,
    },
    question: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $QuestionPost = {
  properties: {
    question: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $ReferenceEntry = {
  properties: {
    type: {
      type: "string",
      isRequired: true,
    },
    key: {
      type: "string",
      isRequired: true,
    },
    file_path: {
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
    url: {
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
    attrs: {
      type: "dictionary",
      contains: {
        properties: {},
      },
      isRequired: true,
    },
  },
} as const

export const $ReferenceFile = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    key: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $References = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    files: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "ReferenceFile",
          },
        },
        {
          type: "null",
        },
      ],
    },
    entries: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "ReferenceEntry",
          },
        },
        {
          type: "null",
        },
      ],
    },
    imported_from: {
      type: "any-of",
      contains: [
        {
          type: "ImportInfo",
        },
        {
          type: "null",
        },
      ],
    },
    raw_text: {
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

export const $ReproCheck = {
  properties: {
    has_pipeline: {
      type: "boolean",
      isRequired: true,
    },
    has_readme: {
      type: "boolean",
      isRequired: true,
    },
    instructions_in_readme: {
      type: "boolean",
      isRequired: true,
    },
    is_dvc_repo: {
      type: "boolean",
      isRequired: true,
    },
    is_git_repo: {
      type: "boolean",
      isRequired: true,
    },
    has_calkit_info: {
      type: "boolean",
      isRequired: true,
    },
    has_dev_container: {
      type: "boolean",
      isRequired: true,
    },
    n_environments: {
      type: "number",
      isRequired: true,
    },
    n_stages: {
      type: "number",
      isRequired: true,
    },
    stages_with_env: {
      type: "array",
      contains: {
        type: "string",
      },
      isRequired: true,
    },
    stages_without_env: {
      type: "array",
      contains: {
        type: "string",
      },
      isRequired: true,
    },
    n_datasets: {
      type: "number",
      isRequired: true,
    },
    n_datasets_no_import_or_stage: {
      type: "number",
      isRequired: true,
    },
    n_figures: {
      type: "number",
      isRequired: true,
    },
    n_figures_no_import_or_stage: {
      type: "number",
      isRequired: true,
    },
    n_publications: {
      type: "number",
      isRequired: true,
    },
    n_publications_no_import_or_stage: {
      type: "number",
      isRequired: true,
    },
    n_dvc_remotes: {
      type: "number",
      isRequired: true,
    },
    recommendation: {
      type: "any-of",
      description: `Formulate a recommendation for the project.`,
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
      isReadOnly: true,
      isRequired: true,
    },
    n_datasets_with_import_or_stage: {
      type: "number",
      isReadOnly: true,
      isRequired: true,
    },
    n_figures_with_import_or_stage: {
      type: "number",
      isReadOnly: true,
      isRequired: true,
    },
    n_publications_with_import_or_stage: {
      type: "number",
      isReadOnly: true,
      isRequired: true,
    },
    n_stages_without_env: {
      type: "number",
      isReadOnly: true,
      isRequired: true,
    },
    n_stages_with_env: {
      type: "number",
      isReadOnly: true,
      isRequired: true,
    },
  },
} as const

export const $Showcase = {
  properties: {
    elements: {
      type: "array",
      contains: {
        type: "any-of",
        contains: [
          {
            type: "ShowcaseFigure",
          },
          {
            type: "ShowcasePublication",
          },
          {
            type: "ShowcaseText",
          },
          {
            type: "ShowcaseMarkdown",
          },
          {
            type: "ShowcaseYaml",
          },
          {
            type: "ShowcaseNotebook",
          },
        ],
      },
      isRequired: true,
    },
  },
} as const

export const $ShowcaseFigure = {
  properties: {
    figure: {
      type: "Figure",
      isRequired: true,
    },
  },
} as const

export const $ShowcaseMarkdown = {
  properties: {
    markdown: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $ShowcaseNotebook = {
  properties: {
    notebook: {
      type: "Notebook",
      isRequired: true,
    },
  },
} as const

export const $ShowcasePublication = {
  properties: {
    publication: {
      type: "Publication",
      isRequired: true,
    },
  },
} as const

export const $ShowcaseText = {
  properties: {
    text: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $ShowcaseYaml = {
  properties: {
    yaml: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $Software = {
  properties: {
    environments: {
      type: "array",
      contains: {
        type: "Environment",
      },
      isRequired: true,
    },
  },
} as const

export const $StorageUsage = {
  properties: {
    limit_gb: {
      type: "number",
      isRequired: true,
    },
    used_gb: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $SubscriptionPlan = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    id: {
      type: "number",
      isRequired: true,
    },
    price: {
      type: "number",
      isRequired: true,
    },
    private_projects_limit: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    storage_limit: {
      type: "number",
      isRequired: true,
    },
    annual_discount_factor: {
      type: "number",
      default: 0.9,
    },
  },
} as const

export const $SubscriptionUpdate = {
  properties: {
    plan_name: {
      type: "Enum",
      enum: ["free", "standard", "professional"],
      isRequired: true,
    },
    period: {
      type: "Enum",
      enum: ["monthly", "annual"],
      isRequired: true,
    },
    discount_code: {
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

export const $TokenPatch = {
  properties: {
    is_active: {
      type: "boolean",
      isRequired: true,
    },
  },
} as const

export const $TokenPost = {
  properties: {
    expires_days: {
      type: "number",
      isRequired: true,
      maximum: 1095,
      minimum: 1,
    },
    scope: {
      type: "any-of",
      contains: [
        {
          type: '"dvc"',
        },
        {
          type: "null",
        },
      ],
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
    },
  },
} as const

export const $TokenResp = {
  properties: {
    access_token: {
      type: "string",
      isRequired: true,
    },
    token_type: {
      type: "string",
      default: "bearer",
    },
    id: {
      type: "string",
      format: "uuid",
    },
    user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    scope: {
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
    created: {
      type: "string",
      format: "date-time",
    },
    updated: {
      type: "string",
      format: "date-time",
    },
    expires: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
    is_active: {
      type: "boolean",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 256,
        },
        {
          type: "null",
        },
      ],
    },
    last_used: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
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
    password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
    account_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 64,
        },
        {
          type: "null",
        },
      ],
    },
    github_username: {
      type: "string",
      maxLength: 64,
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
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    github_username: {
      type: "string",
      isRequired: true,
    },
    subscription: {
      type: "any-of",
      contains: [
        {
          type: "UserSubscription",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
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
    account_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 64,
        },
        {
          type: "null",
        },
      ],
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

export const $UserSubscription = {
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
    created: {
      type: "string",
      format: "date-time",
    },
    period_months: {
      type: "number",
      isRequired: true,
    },
    price: {
      type: "number",
      isRequired: true,
    },
    paid_until: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
    },
    plan_id: {
      type: "number",
      isRequired: true,
      maximum: 2,
      minimum: 0,
    },
    is_active: {
      type: "boolean",
      default: true,
    },
    processor: {
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
    processor_product_id: {
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
    processor_price_id: {
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
    processor_subscription_id: {
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
    user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    plan_name: {
      type: "string",
      isReadOnly: true,
      isRequired: true,
    },
  },
} as const

export const $UserTokenPublic = {
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
    user_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    scope: {
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
    created: {
      type: "string",
      format: "date-time",
    },
    updated: {
      type: "string",
      format: "date-time",
    },
    expires: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
    is_active: {
      type: "boolean",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 256,
        },
        {
          type: "null",
        },
      ],
    },
    last_used: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
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

export const $_ContentsItemBase = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    path: {
      type: "string",
      isRequired: true,
    },
    type: {
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
    size: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    in_repo: {
      type: "boolean",
      isRequired: true,
    },
    content: {
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
    url: {
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
    calkit_object: {
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
    lock: {
      type: "any-of",
      contains: [
        {
          type: "ItemLock",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const
