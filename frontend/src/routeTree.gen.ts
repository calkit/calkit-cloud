/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as ZenodoAuthImport } from './routes/zenodo-auth'
import { Route as ResetPasswordImport } from './routes/reset-password'
import { Route as RecoverPasswordImport } from './routes/recover-password'
import { Route as LoginImport } from './routes/login'
import { Route as CheckoutImport } from './routes/checkout'
import { Route as LayoutImport } from './routes/_layout'
import { Route as LayoutIndexImport } from './routes/_layout/index'
import { Route as LayoutSettingsImport } from './routes/_layout/settings'
import { Route as LayoutProjectsImport } from './routes/_layout/projects'
import { Route as LayoutLearnImport } from './routes/_layout/learn'
import { Route as LayoutDatasetsImport } from './routes/_layout/datasets'
import { Route as LayoutAdminImport } from './routes/_layout/admin'
import { Route as LayoutUserNameProjectNameLayoutImport } from './routes/_layout/$userName/$projectName/_layout'
import { Route as LayoutUserNameProjectNameLayoutIndexImport } from './routes/_layout/$userName/$projectName/_layout/index'
import { Route as LayoutUserNameProjectNameLayoutSoftwareImport } from './routes/_layout/$userName/$projectName/_layout/software'
import { Route as LayoutUserNameProjectNameLayoutReferencesImport } from './routes/_layout/$userName/$projectName/_layout/references'
import { Route as LayoutUserNameProjectNameLayoutPublicationsImport } from './routes/_layout/$userName/$projectName/_layout/publications'
import { Route as LayoutUserNameProjectNameLayoutPipelineImport } from './routes/_layout/$userName/$projectName/_layout/pipeline'
import { Route as LayoutUserNameProjectNameLayoutNotebooksImport } from './routes/_layout/$userName/$projectName/_layout/notebooks'
import { Route as LayoutUserNameProjectNameLayoutLocalImport } from './routes/_layout/$userName/$projectName/_layout/local'
import { Route as LayoutUserNameProjectNameLayoutFilesImport } from './routes/_layout/$userName/$projectName/_layout/files'
import { Route as LayoutUserNameProjectNameLayoutFiguresImport } from './routes/_layout/$userName/$projectName/_layout/figures'
import { Route as LayoutUserNameProjectNameLayoutDatasetsImport } from './routes/_layout/$userName/$projectName/_layout/datasets'
import { Route as LayoutUserNameProjectNameLayoutCollaboratorsImport } from './routes/_layout/$userName/$projectName/_layout/collaborators'
import { Route as LayoutUserNameProjectNameLayoutAppImport } from './routes/_layout/$userName/$projectName/_layout/app'

// Create Virtual Routes

const LayoutUserNameProjectNameImport = createFileRoute(
  '/_layout/$userName/$projectName',
)()

// Create/Update Routes

const ZenodoAuthRoute = ZenodoAuthImport.update({
  id: '/zenodo-auth',
  path: '/zenodo-auth',
  getParentRoute: () => rootRoute,
} as any)

const ResetPasswordRoute = ResetPasswordImport.update({
  id: '/reset-password',
  path: '/reset-password',
  getParentRoute: () => rootRoute,
} as any)

const RecoverPasswordRoute = RecoverPasswordImport.update({
  id: '/recover-password',
  path: '/recover-password',
  getParentRoute: () => rootRoute,
} as any)

const LoginRoute = LoginImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRoute,
} as any)

const CheckoutRoute = CheckoutImport.update({
  id: '/checkout',
  path: '/checkout',
  getParentRoute: () => rootRoute,
} as any)

const LayoutRoute = LayoutImport.update({
  id: '/_layout',
  getParentRoute: () => rootRoute,
} as any)

const LayoutIndexRoute = LayoutIndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutSettingsRoute = LayoutSettingsImport.update({
  id: '/settings',
  path: '/settings',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutProjectsRoute = LayoutProjectsImport.update({
  id: '/projects',
  path: '/projects',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutLearnRoute = LayoutLearnImport.update({
  id: '/learn',
  path: '/learn',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutDatasetsRoute = LayoutDatasetsImport.update({
  id: '/datasets',
  path: '/datasets',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutAdminRoute = LayoutAdminImport.update({
  id: '/admin',
  path: '/admin',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutUserNameProjectNameRoute = LayoutUserNameProjectNameImport.update({
  id: '/$userName/$projectName',
  path: '/$userName/$projectName',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutUserNameProjectNameLayoutRoute =
  LayoutUserNameProjectNameLayoutImport.update({
    id: '/_layout',
    getParentRoute: () => LayoutUserNameProjectNameRoute,
  } as any)

const LayoutUserNameProjectNameLayoutIndexRoute =
  LayoutUserNameProjectNameLayoutIndexImport.update({
    id: '/',
    path: '/',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutSoftwareRoute =
  LayoutUserNameProjectNameLayoutSoftwareImport.update({
    id: '/software',
    path: '/software',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutReferencesRoute =
  LayoutUserNameProjectNameLayoutReferencesImport.update({
    id: '/references',
    path: '/references',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutPublicationsRoute =
  LayoutUserNameProjectNameLayoutPublicationsImport.update({
    id: '/publications',
    path: '/publications',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutPipelineRoute =
  LayoutUserNameProjectNameLayoutPipelineImport.update({
    id: '/pipeline',
    path: '/pipeline',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutNotebooksRoute =
  LayoutUserNameProjectNameLayoutNotebooksImport.update({
    id: '/notebooks',
    path: '/notebooks',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutLocalRoute =
  LayoutUserNameProjectNameLayoutLocalImport.update({
    id: '/local',
    path: '/local',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutFilesRoute =
  LayoutUserNameProjectNameLayoutFilesImport.update({
    id: '/files',
    path: '/files',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutFiguresRoute =
  LayoutUserNameProjectNameLayoutFiguresImport.update({
    id: '/figures',
    path: '/figures',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutDatasetsRoute =
  LayoutUserNameProjectNameLayoutDatasetsImport.update({
    id: '/datasets',
    path: '/datasets',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutCollaboratorsRoute =
  LayoutUserNameProjectNameLayoutCollaboratorsImport.update({
    id: '/collaborators',
    path: '/collaborators',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

const LayoutUserNameProjectNameLayoutAppRoute =
  LayoutUserNameProjectNameLayoutAppImport.update({
    id: '/app',
    path: '/app',
    getParentRoute: () => LayoutUserNameProjectNameLayoutRoute,
  } as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/_layout': {
      id: '/_layout'
      path: ''
      fullPath: ''
      preLoaderRoute: typeof LayoutImport
      parentRoute: typeof rootRoute
    }
    '/checkout': {
      id: '/checkout'
      path: '/checkout'
      fullPath: '/checkout'
      preLoaderRoute: typeof CheckoutImport
      parentRoute: typeof rootRoute
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginImport
      parentRoute: typeof rootRoute
    }
    '/recover-password': {
      id: '/recover-password'
      path: '/recover-password'
      fullPath: '/recover-password'
      preLoaderRoute: typeof RecoverPasswordImport
      parentRoute: typeof rootRoute
    }
    '/reset-password': {
      id: '/reset-password'
      path: '/reset-password'
      fullPath: '/reset-password'
      preLoaderRoute: typeof ResetPasswordImport
      parentRoute: typeof rootRoute
    }
    '/zenodo-auth': {
      id: '/zenodo-auth'
      path: '/zenodo-auth'
      fullPath: '/zenodo-auth'
      preLoaderRoute: typeof ZenodoAuthImport
      parentRoute: typeof rootRoute
    }
    '/_layout/admin': {
      id: '/_layout/admin'
      path: '/admin'
      fullPath: '/admin'
      preLoaderRoute: typeof LayoutAdminImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/datasets': {
      id: '/_layout/datasets'
      path: '/datasets'
      fullPath: '/datasets'
      preLoaderRoute: typeof LayoutDatasetsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/learn': {
      id: '/_layout/learn'
      path: '/learn'
      fullPath: '/learn'
      preLoaderRoute: typeof LayoutLearnImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/projects': {
      id: '/_layout/projects'
      path: '/projects'
      fullPath: '/projects'
      preLoaderRoute: typeof LayoutProjectsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/settings': {
      id: '/_layout/settings'
      path: '/settings'
      fullPath: '/settings'
      preLoaderRoute: typeof LayoutSettingsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/': {
      id: '/_layout/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof LayoutIndexImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/$userName/$projectName': {
      id: '/_layout/$userName/$projectName'
      path: '/$userName/$projectName'
      fullPath: '/$userName/$projectName'
      preLoaderRoute: typeof LayoutUserNameProjectNameImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/$userName/$projectName/_layout': {
      id: '/_layout/$userName/$projectName/_layout'
      path: '/$userName/$projectName'
      fullPath: '/$userName/$projectName'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutImport
      parentRoute: typeof LayoutUserNameProjectNameRoute
    }
    '/_layout/$userName/$projectName/_layout/app': {
      id: '/_layout/$userName/$projectName/_layout/app'
      path: '/app'
      fullPath: '/$userName/$projectName/app'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutAppImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/collaborators': {
      id: '/_layout/$userName/$projectName/_layout/collaborators'
      path: '/collaborators'
      fullPath: '/$userName/$projectName/collaborators'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutCollaboratorsImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/datasets': {
      id: '/_layout/$userName/$projectName/_layout/datasets'
      path: '/datasets'
      fullPath: '/$userName/$projectName/datasets'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutDatasetsImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/figures': {
      id: '/_layout/$userName/$projectName/_layout/figures'
      path: '/figures'
      fullPath: '/$userName/$projectName/figures'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutFiguresImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/files': {
      id: '/_layout/$userName/$projectName/_layout/files'
      path: '/files'
      fullPath: '/$userName/$projectName/files'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutFilesImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/local': {
      id: '/_layout/$userName/$projectName/_layout/local'
      path: '/local'
      fullPath: '/$userName/$projectName/local'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutLocalImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/notebooks': {
      id: '/_layout/$userName/$projectName/_layout/notebooks'
      path: '/notebooks'
      fullPath: '/$userName/$projectName/notebooks'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutNotebooksImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/pipeline': {
      id: '/_layout/$userName/$projectName/_layout/pipeline'
      path: '/pipeline'
      fullPath: '/$userName/$projectName/pipeline'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutPipelineImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/publications': {
      id: '/_layout/$userName/$projectName/_layout/publications'
      path: '/publications'
      fullPath: '/$userName/$projectName/publications'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutPublicationsImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/references': {
      id: '/_layout/$userName/$projectName/_layout/references'
      path: '/references'
      fullPath: '/$userName/$projectName/references'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutReferencesImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/software': {
      id: '/_layout/$userName/$projectName/_layout/software'
      path: '/software'
      fullPath: '/$userName/$projectName/software'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutSoftwareImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
    '/_layout/$userName/$projectName/_layout/': {
      id: '/_layout/$userName/$projectName/_layout/'
      path: '/'
      fullPath: '/$userName/$projectName/'
      preLoaderRoute: typeof LayoutUserNameProjectNameLayoutIndexImport
      parentRoute: typeof LayoutUserNameProjectNameLayoutImport
    }
  }
}

// Create and export the route tree

interface LayoutUserNameProjectNameLayoutRouteChildren {
  LayoutUserNameProjectNameLayoutAppRoute: typeof LayoutUserNameProjectNameLayoutAppRoute
  LayoutUserNameProjectNameLayoutCollaboratorsRoute: typeof LayoutUserNameProjectNameLayoutCollaboratorsRoute
  LayoutUserNameProjectNameLayoutDatasetsRoute: typeof LayoutUserNameProjectNameLayoutDatasetsRoute
  LayoutUserNameProjectNameLayoutFiguresRoute: typeof LayoutUserNameProjectNameLayoutFiguresRoute
  LayoutUserNameProjectNameLayoutFilesRoute: typeof LayoutUserNameProjectNameLayoutFilesRoute
  LayoutUserNameProjectNameLayoutLocalRoute: typeof LayoutUserNameProjectNameLayoutLocalRoute
  LayoutUserNameProjectNameLayoutNotebooksRoute: typeof LayoutUserNameProjectNameLayoutNotebooksRoute
  LayoutUserNameProjectNameLayoutPipelineRoute: typeof LayoutUserNameProjectNameLayoutPipelineRoute
  LayoutUserNameProjectNameLayoutPublicationsRoute: typeof LayoutUserNameProjectNameLayoutPublicationsRoute
  LayoutUserNameProjectNameLayoutReferencesRoute: typeof LayoutUserNameProjectNameLayoutReferencesRoute
  LayoutUserNameProjectNameLayoutSoftwareRoute: typeof LayoutUserNameProjectNameLayoutSoftwareRoute
  LayoutUserNameProjectNameLayoutIndexRoute: typeof LayoutUserNameProjectNameLayoutIndexRoute
}

const LayoutUserNameProjectNameLayoutRouteChildren: LayoutUserNameProjectNameLayoutRouteChildren =
  {
    LayoutUserNameProjectNameLayoutAppRoute:
      LayoutUserNameProjectNameLayoutAppRoute,
    LayoutUserNameProjectNameLayoutCollaboratorsRoute:
      LayoutUserNameProjectNameLayoutCollaboratorsRoute,
    LayoutUserNameProjectNameLayoutDatasetsRoute:
      LayoutUserNameProjectNameLayoutDatasetsRoute,
    LayoutUserNameProjectNameLayoutFiguresRoute:
      LayoutUserNameProjectNameLayoutFiguresRoute,
    LayoutUserNameProjectNameLayoutFilesRoute:
      LayoutUserNameProjectNameLayoutFilesRoute,
    LayoutUserNameProjectNameLayoutLocalRoute:
      LayoutUserNameProjectNameLayoutLocalRoute,
    LayoutUserNameProjectNameLayoutNotebooksRoute:
      LayoutUserNameProjectNameLayoutNotebooksRoute,
    LayoutUserNameProjectNameLayoutPipelineRoute:
      LayoutUserNameProjectNameLayoutPipelineRoute,
    LayoutUserNameProjectNameLayoutPublicationsRoute:
      LayoutUserNameProjectNameLayoutPublicationsRoute,
    LayoutUserNameProjectNameLayoutReferencesRoute:
      LayoutUserNameProjectNameLayoutReferencesRoute,
    LayoutUserNameProjectNameLayoutSoftwareRoute:
      LayoutUserNameProjectNameLayoutSoftwareRoute,
    LayoutUserNameProjectNameLayoutIndexRoute:
      LayoutUserNameProjectNameLayoutIndexRoute,
  }

const LayoutUserNameProjectNameLayoutRouteWithChildren =
  LayoutUserNameProjectNameLayoutRoute._addFileChildren(
    LayoutUserNameProjectNameLayoutRouteChildren,
  )

interface LayoutUserNameProjectNameRouteChildren {
  LayoutUserNameProjectNameLayoutRoute: typeof LayoutUserNameProjectNameLayoutRouteWithChildren
}

const LayoutUserNameProjectNameRouteChildren: LayoutUserNameProjectNameRouteChildren =
  {
    LayoutUserNameProjectNameLayoutRoute:
      LayoutUserNameProjectNameLayoutRouteWithChildren,
  }

const LayoutUserNameProjectNameRouteWithChildren =
  LayoutUserNameProjectNameRoute._addFileChildren(
    LayoutUserNameProjectNameRouteChildren,
  )

interface LayoutRouteChildren {
  LayoutAdminRoute: typeof LayoutAdminRoute
  LayoutDatasetsRoute: typeof LayoutDatasetsRoute
  LayoutLearnRoute: typeof LayoutLearnRoute
  LayoutProjectsRoute: typeof LayoutProjectsRoute
  LayoutSettingsRoute: typeof LayoutSettingsRoute
  LayoutIndexRoute: typeof LayoutIndexRoute
  LayoutUserNameProjectNameRoute: typeof LayoutUserNameProjectNameRouteWithChildren
}

const LayoutRouteChildren: LayoutRouteChildren = {
  LayoutAdminRoute: LayoutAdminRoute,
  LayoutDatasetsRoute: LayoutDatasetsRoute,
  LayoutLearnRoute: LayoutLearnRoute,
  LayoutProjectsRoute: LayoutProjectsRoute,
  LayoutSettingsRoute: LayoutSettingsRoute,
  LayoutIndexRoute: LayoutIndexRoute,
  LayoutUserNameProjectNameRoute: LayoutUserNameProjectNameRouteWithChildren,
}

const LayoutRouteWithChildren =
  LayoutRoute._addFileChildren(LayoutRouteChildren)

export interface FileRoutesByFullPath {
  '': typeof LayoutRouteWithChildren
  '/checkout': typeof CheckoutRoute
  '/login': typeof LoginRoute
  '/recover-password': typeof RecoverPasswordRoute
  '/reset-password': typeof ResetPasswordRoute
  '/zenodo-auth': typeof ZenodoAuthRoute
  '/admin': typeof LayoutAdminRoute
  '/datasets': typeof LayoutDatasetsRoute
  '/learn': typeof LayoutLearnRoute
  '/projects': typeof LayoutProjectsRoute
  '/settings': typeof LayoutSettingsRoute
  '/': typeof LayoutIndexRoute
  '/$userName/$projectName': typeof LayoutUserNameProjectNameLayoutRouteWithChildren
  '/$userName/$projectName/app': typeof LayoutUserNameProjectNameLayoutAppRoute
  '/$userName/$projectName/collaborators': typeof LayoutUserNameProjectNameLayoutCollaboratorsRoute
  '/$userName/$projectName/datasets': typeof LayoutUserNameProjectNameLayoutDatasetsRoute
  '/$userName/$projectName/figures': typeof LayoutUserNameProjectNameLayoutFiguresRoute
  '/$userName/$projectName/files': typeof LayoutUserNameProjectNameLayoutFilesRoute
  '/$userName/$projectName/local': typeof LayoutUserNameProjectNameLayoutLocalRoute
  '/$userName/$projectName/notebooks': typeof LayoutUserNameProjectNameLayoutNotebooksRoute
  '/$userName/$projectName/pipeline': typeof LayoutUserNameProjectNameLayoutPipelineRoute
  '/$userName/$projectName/publications': typeof LayoutUserNameProjectNameLayoutPublicationsRoute
  '/$userName/$projectName/references': typeof LayoutUserNameProjectNameLayoutReferencesRoute
  '/$userName/$projectName/software': typeof LayoutUserNameProjectNameLayoutSoftwareRoute
  '/$userName/$projectName/': typeof LayoutUserNameProjectNameLayoutIndexRoute
}

export interface FileRoutesByTo {
  '/checkout': typeof CheckoutRoute
  '/login': typeof LoginRoute
  '/recover-password': typeof RecoverPasswordRoute
  '/reset-password': typeof ResetPasswordRoute
  '/zenodo-auth': typeof ZenodoAuthRoute
  '/admin': typeof LayoutAdminRoute
  '/datasets': typeof LayoutDatasetsRoute
  '/learn': typeof LayoutLearnRoute
  '/projects': typeof LayoutProjectsRoute
  '/settings': typeof LayoutSettingsRoute
  '/': typeof LayoutIndexRoute
  '/$userName/$projectName': typeof LayoutUserNameProjectNameLayoutIndexRoute
  '/$userName/$projectName/app': typeof LayoutUserNameProjectNameLayoutAppRoute
  '/$userName/$projectName/collaborators': typeof LayoutUserNameProjectNameLayoutCollaboratorsRoute
  '/$userName/$projectName/datasets': typeof LayoutUserNameProjectNameLayoutDatasetsRoute
  '/$userName/$projectName/figures': typeof LayoutUserNameProjectNameLayoutFiguresRoute
  '/$userName/$projectName/files': typeof LayoutUserNameProjectNameLayoutFilesRoute
  '/$userName/$projectName/local': typeof LayoutUserNameProjectNameLayoutLocalRoute
  '/$userName/$projectName/notebooks': typeof LayoutUserNameProjectNameLayoutNotebooksRoute
  '/$userName/$projectName/pipeline': typeof LayoutUserNameProjectNameLayoutPipelineRoute
  '/$userName/$projectName/publications': typeof LayoutUserNameProjectNameLayoutPublicationsRoute
  '/$userName/$projectName/references': typeof LayoutUserNameProjectNameLayoutReferencesRoute
  '/$userName/$projectName/software': typeof LayoutUserNameProjectNameLayoutSoftwareRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/_layout': typeof LayoutRouteWithChildren
  '/checkout': typeof CheckoutRoute
  '/login': typeof LoginRoute
  '/recover-password': typeof RecoverPasswordRoute
  '/reset-password': typeof ResetPasswordRoute
  '/zenodo-auth': typeof ZenodoAuthRoute
  '/_layout/admin': typeof LayoutAdminRoute
  '/_layout/datasets': typeof LayoutDatasetsRoute
  '/_layout/learn': typeof LayoutLearnRoute
  '/_layout/projects': typeof LayoutProjectsRoute
  '/_layout/settings': typeof LayoutSettingsRoute
  '/_layout/': typeof LayoutIndexRoute
  '/_layout/$userName/$projectName': typeof LayoutUserNameProjectNameRouteWithChildren
  '/_layout/$userName/$projectName/_layout': typeof LayoutUserNameProjectNameLayoutRouteWithChildren
  '/_layout/$userName/$projectName/_layout/app': typeof LayoutUserNameProjectNameLayoutAppRoute
  '/_layout/$userName/$projectName/_layout/collaborators': typeof LayoutUserNameProjectNameLayoutCollaboratorsRoute
  '/_layout/$userName/$projectName/_layout/datasets': typeof LayoutUserNameProjectNameLayoutDatasetsRoute
  '/_layout/$userName/$projectName/_layout/figures': typeof LayoutUserNameProjectNameLayoutFiguresRoute
  '/_layout/$userName/$projectName/_layout/files': typeof LayoutUserNameProjectNameLayoutFilesRoute
  '/_layout/$userName/$projectName/_layout/local': typeof LayoutUserNameProjectNameLayoutLocalRoute
  '/_layout/$userName/$projectName/_layout/notebooks': typeof LayoutUserNameProjectNameLayoutNotebooksRoute
  '/_layout/$userName/$projectName/_layout/pipeline': typeof LayoutUserNameProjectNameLayoutPipelineRoute
  '/_layout/$userName/$projectName/_layout/publications': typeof LayoutUserNameProjectNameLayoutPublicationsRoute
  '/_layout/$userName/$projectName/_layout/references': typeof LayoutUserNameProjectNameLayoutReferencesRoute
  '/_layout/$userName/$projectName/_layout/software': typeof LayoutUserNameProjectNameLayoutSoftwareRoute
  '/_layout/$userName/$projectName/_layout/': typeof LayoutUserNameProjectNameLayoutIndexRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | ''
    | '/checkout'
    | '/login'
    | '/recover-password'
    | '/reset-password'
    | '/zenodo-auth'
    | '/admin'
    | '/datasets'
    | '/learn'
    | '/projects'
    | '/settings'
    | '/'
    | '/$userName/$projectName'
    | '/$userName/$projectName/app'
    | '/$userName/$projectName/collaborators'
    | '/$userName/$projectName/datasets'
    | '/$userName/$projectName/figures'
    | '/$userName/$projectName/files'
    | '/$userName/$projectName/local'
    | '/$userName/$projectName/notebooks'
    | '/$userName/$projectName/pipeline'
    | '/$userName/$projectName/publications'
    | '/$userName/$projectName/references'
    | '/$userName/$projectName/software'
    | '/$userName/$projectName/'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/checkout'
    | '/login'
    | '/recover-password'
    | '/reset-password'
    | '/zenodo-auth'
    | '/admin'
    | '/datasets'
    | '/learn'
    | '/projects'
    | '/settings'
    | '/'
    | '/$userName/$projectName'
    | '/$userName/$projectName/app'
    | '/$userName/$projectName/collaborators'
    | '/$userName/$projectName/datasets'
    | '/$userName/$projectName/figures'
    | '/$userName/$projectName/files'
    | '/$userName/$projectName/local'
    | '/$userName/$projectName/notebooks'
    | '/$userName/$projectName/pipeline'
    | '/$userName/$projectName/publications'
    | '/$userName/$projectName/references'
    | '/$userName/$projectName/software'
  id:
    | '__root__'
    | '/_layout'
    | '/checkout'
    | '/login'
    | '/recover-password'
    | '/reset-password'
    | '/zenodo-auth'
    | '/_layout/admin'
    | '/_layout/datasets'
    | '/_layout/learn'
    | '/_layout/projects'
    | '/_layout/settings'
    | '/_layout/'
    | '/_layout/$userName/$projectName'
    | '/_layout/$userName/$projectName/_layout'
    | '/_layout/$userName/$projectName/_layout/app'
    | '/_layout/$userName/$projectName/_layout/collaborators'
    | '/_layout/$userName/$projectName/_layout/datasets'
    | '/_layout/$userName/$projectName/_layout/figures'
    | '/_layout/$userName/$projectName/_layout/files'
    | '/_layout/$userName/$projectName/_layout/local'
    | '/_layout/$userName/$projectName/_layout/notebooks'
    | '/_layout/$userName/$projectName/_layout/pipeline'
    | '/_layout/$userName/$projectName/_layout/publications'
    | '/_layout/$userName/$projectName/_layout/references'
    | '/_layout/$userName/$projectName/_layout/software'
    | '/_layout/$userName/$projectName/_layout/'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  LayoutRoute: typeof LayoutRouteWithChildren
  CheckoutRoute: typeof CheckoutRoute
  LoginRoute: typeof LoginRoute
  RecoverPasswordRoute: typeof RecoverPasswordRoute
  ResetPasswordRoute: typeof ResetPasswordRoute
  ZenodoAuthRoute: typeof ZenodoAuthRoute
}

const rootRouteChildren: RootRouteChildren = {
  LayoutRoute: LayoutRouteWithChildren,
  CheckoutRoute: CheckoutRoute,
  LoginRoute: LoginRoute,
  RecoverPasswordRoute: RecoverPasswordRoute,
  ResetPasswordRoute: ResetPasswordRoute,
  ZenodoAuthRoute: ZenodoAuthRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/_layout",
        "/checkout",
        "/login",
        "/recover-password",
        "/reset-password",
        "/zenodo-auth"
      ]
    },
    "/_layout": {
      "filePath": "_layout.tsx",
      "children": [
        "/_layout/admin",
        "/_layout/datasets",
        "/_layout/learn",
        "/_layout/projects",
        "/_layout/settings",
        "/_layout/",
        "/_layout/$userName/$projectName"
      ]
    },
    "/checkout": {
      "filePath": "checkout.tsx"
    },
    "/login": {
      "filePath": "login.tsx"
    },
    "/recover-password": {
      "filePath": "recover-password.tsx"
    },
    "/reset-password": {
      "filePath": "reset-password.tsx"
    },
    "/zenodo-auth": {
      "filePath": "zenodo-auth.tsx"
    },
    "/_layout/admin": {
      "filePath": "_layout/admin.tsx",
      "parent": "/_layout"
    },
    "/_layout/datasets": {
      "filePath": "_layout/datasets.tsx",
      "parent": "/_layout"
    },
    "/_layout/learn": {
      "filePath": "_layout/learn.tsx",
      "parent": "/_layout"
    },
    "/_layout/projects": {
      "filePath": "_layout/projects.tsx",
      "parent": "/_layout"
    },
    "/_layout/settings": {
      "filePath": "_layout/settings.tsx",
      "parent": "/_layout"
    },
    "/_layout/": {
      "filePath": "_layout/index.tsx",
      "parent": "/_layout"
    },
    "/_layout/$userName/$projectName": {
      "filePath": "_layout/$userName/$projectName",
      "parent": "/_layout",
      "children": [
        "/_layout/$userName/$projectName/_layout"
      ]
    },
    "/_layout/$userName/$projectName/_layout": {
      "filePath": "_layout/$userName/$projectName/_layout.tsx",
      "parent": "/_layout/$userName/$projectName",
      "children": [
        "/_layout/$userName/$projectName/_layout/app",
        "/_layout/$userName/$projectName/_layout/collaborators",
        "/_layout/$userName/$projectName/_layout/datasets",
        "/_layout/$userName/$projectName/_layout/figures",
        "/_layout/$userName/$projectName/_layout/files",
        "/_layout/$userName/$projectName/_layout/local",
        "/_layout/$userName/$projectName/_layout/notebooks",
        "/_layout/$userName/$projectName/_layout/pipeline",
        "/_layout/$userName/$projectName/_layout/publications",
        "/_layout/$userName/$projectName/_layout/references",
        "/_layout/$userName/$projectName/_layout/software",
        "/_layout/$userName/$projectName/_layout/"
      ]
    },
    "/_layout/$userName/$projectName/_layout/app": {
      "filePath": "_layout/$userName/$projectName/_layout/app.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/collaborators": {
      "filePath": "_layout/$userName/$projectName/_layout/collaborators.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/datasets": {
      "filePath": "_layout/$userName/$projectName/_layout/datasets.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/figures": {
      "filePath": "_layout/$userName/$projectName/_layout/figures.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/files": {
      "filePath": "_layout/$userName/$projectName/_layout/files.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/local": {
      "filePath": "_layout/$userName/$projectName/_layout/local.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/notebooks": {
      "filePath": "_layout/$userName/$projectName/_layout/notebooks.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/pipeline": {
      "filePath": "_layout/$userName/$projectName/_layout/pipeline.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/publications": {
      "filePath": "_layout/$userName/$projectName/_layout/publications.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/references": {
      "filePath": "_layout/$userName/$projectName/_layout/references.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/software": {
      "filePath": "_layout/$userName/$projectName/_layout/software.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    },
    "/_layout/$userName/$projectName/_layout/": {
      "filePath": "_layout/$userName/$projectName/_layout/index.tsx",
      "parent": "/_layout/$userName/$projectName/_layout"
    }
  }
}
ROUTE_MANIFEST_END */
