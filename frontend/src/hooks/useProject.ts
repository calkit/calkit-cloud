import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { type Issue, ProjectsService } from "../client"

const useProject = (accountName: string, projectName: string, ref?: string) => {
  const queryClient = useQueryClient()

  const projectRequest = useQuery({
    queryKey: ["projects", accountName, projectName],
    queryFn: () =>
      ProjectsService.getProject({
        ownerName: accountName,
        projectName: projectName,
        getExtendedInfo: true,
      }),
    retry: (failureCount, error) => {
      if (error.message === "Not Found" || error.message === "Forbidden") {
        return false
      }
      return failureCount < 3
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const userHasWriteAccess = ["owner", "admin", "write"].includes(
    String(projectRequest.data?.current_user_access),
  )

  const showcaseRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "showcase", ref],
    queryFn: () =>
      ProjectsService.getProjectShowcase({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const putDevcontainerMutation = useMutation({
    mutationFn: () =>
      ProjectsService.putProjectDevContainer({
        ownerName: accountName,
        projectName: projectName,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["projects", accountName, projectName, "repro-check"],
      }),
  })

  return {
    projectRequest,
    userHasWriteAccess,
    showcaseRequest,
    putDevcontainerMutation,
  }
}

const useProjectReadme = (
  accountName: string,
  projectName: string,
  ref?: string,
) => {
  const readmeRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "readme", ref],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: accountName,
        projectName: projectName,
        path: "README.md",
        ref,
      }),
  })
  return { readmeRequest }
}

const useProjectQuestions = (
  accountName: string,
  projectName: string,
  ref?: string,
) => {
  const questionsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "questions", ref],
    queryFn: () =>
      ProjectsService.getProjectQuestions({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })
  return { questionsRequest }
}

const useProjectFigures = (accountName: string, projectName: string) => {
  const figuresRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "figures"],
    queryFn: () =>
      ProjectsService.getProjectFigures({
        ownerName: accountName,
        projectName: projectName,
      }),
  })
  return { figuresRequest }
}

const useProjectFiles = (accountName: string, projectName: string) => {
  const filesRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "files"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: accountName,
        projectName: projectName,
      }),
  })
  return { filesRequest }
}

const useProjectDatasets = (
  accountName: string,
  projectName: string,
  ref?: string,
) => {
  const datasetsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "datasets", ref],
    queryFn: () =>
      ProjectsService.getProjectDatasets({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })

  return { datasetsRequest }
}

const useProjectEnvironments = (
  accountName: string,
  projectName: string,
  ref?: string,
) => {
  const environmentsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "environments", ref],
    queryFn: () =>
      ProjectsService.getProjectEnvironments({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })

  return { environmentsRequest }
}

const useProjectPublications = (
  accountName: string,
  projectName: string,
  ref?: string,
) => {
  const publicationsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "publications", ref],
    queryFn: () =>
      ProjectsService.getProjectPublications({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })
  return { publicationsRequest }
}

const useProjectPresentations = (
  accountName: string,
  projectName: string,
  ref?: string,
) => {
  const presentationsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "presentations", ref],
    queryFn: () =>
      ProjectsService.getProjectPresentations({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })
  return { presentationsRequest }
}

const useProjectIssues = (accountName: string, projectName: string) => {
  const queryClient = useQueryClient()

  const issuesKey = ["projects", accountName, projectName, "issues"] as const

  // GitHub's REST API is not immediately read-your-writes consistent, so we
  // reconcile with the server only after a delay long enough for it to catch
  // up. This keeps the optimistic UI instant while still picking up the
  // server's truth (and any external changes) eventually.
  const ISSUES_RECONCILE_DELAY_MS = 5000
  const scheduleIssuesReconcile = () => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: issuesKey })
    }, ISSUES_RECONCILE_DELAY_MS)
  }

  // Always fetch every issue and let the UI filter open vs. closed. A single
  // cache keeps the list consistent no matter how the "show closed" toggle is
  // flipped, and lets optimistic updates apply in one place.
  const issuesRequest = useQuery({
    queryKey: issuesKey,
    queryFn: () =>
      ProjectsService.getProjectIssues({
        ownerName: accountName,
        projectName: projectName,
        state: "all",
      }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  interface IssueStateChange {
    state: "open" | "closed"
    issueNumber: number
  }

  const issueStateMutation = useMutation({
    mutationFn: (data: IssueStateChange) =>
      ProjectsService.patchProjectIssue({
        ownerName: accountName,
        projectName: projectName,
        issueNumber: data.issueNumber,
        requestBody: { state: data.state },
      }),
    // Optimistically flip the issue's state so the UI updates instantly
    // despite GitHub's eventual consistency.
    onMutate: async (data: IssueStateChange) => {
      await queryClient.cancelQueries({ queryKey: issuesKey })
      const prevState = queryClient
        .getQueryData<Issue[]>(issuesKey)
        ?.find((i) => i.number === data.issueNumber)?.state
      queryClient.setQueryData<Issue[]>(issuesKey, (old) =>
        old?.map((i) =>
          i.number === data.issueNumber ? { ...i, state: data.state } : i,
        ),
      )
      return { prevState }
    },
    // Roll back only the mutated issue so we don't clobber other cache
    // writes (e.g. a newly created issue) that happened in the meantime.
    onError: (_err, data, context) => {
      if (context?.prevState !== undefined) {
        queryClient.setQueryData<Issue[]>(issuesKey, (old) =>
          old?.map((i) =>
            i.number === data.issueNumber
              ? { ...i, state: context.prevState as Issue["state"] }
              : i,
          ),
        )
      }
    },
    onSettled: scheduleIssuesReconcile,
  })

  return { issueStateMutation, issuesRequest }
}

export {
  useProjectFiles,
  useProjectFigures,
  useProjectPublications,
  useProjectPresentations,
  useProjectReadme,
  useProjectDatasets,
  useProjectEnvironments,
  useProjectIssues,
  useProjectQuestions,
}
export default useProject
