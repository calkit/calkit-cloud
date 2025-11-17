import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ProjectsService } from "../client"

const useProject = (accountName: string, projectName: string) => {
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
    queryKey: ["projects", accountName, projectName, "showcase"],
    queryFn: () =>
      ProjectsService.getProjectShowcase({
        ownerName: accountName,
        projectName: projectName,
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

const useProjectReadme = (accountName: string, projectName: string) => {
  const readmeRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "readme"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: accountName,
        projectName: projectName,
        path: "README.md",
      }),
  })
  return { readmeRequest }
}

const useProjectQuestions = (accountName: string, projectName: string) => {
  const questionsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "questions"],
    queryFn: () =>
      ProjectsService.getProjectQuestions({
        ownerName: accountName,
        projectName: projectName,
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

const useProjectDatasets = (accountName: string, projectName: string) => {
  const datasetsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "datasets"],
    queryFn: () =>
      ProjectsService.getProjectDatasets({
        ownerName: accountName,
        projectName: projectName,
      }),
  })

  return { datasetsRequest }
}

const useProjectEnvironments = (accountName: string, projectName: string) => {
  const environmentsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "environments"],
    queryFn: () =>
      ProjectsService.getProjectEnvironments({
        ownerName: accountName,
        projectName: projectName,
      }),
  })

  return { environmentsRequest }
}

const useProjectPublications = (accountName: string, projectName: string) => {
  const publicationsRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "publications"],
    queryFn: () =>
      ProjectsService.getProjectPublications({
        ownerName: accountName,
        projectName: projectName,
      }),
  })
  return { publicationsRequest }
}

const useProjectIssues = (
  accountName: string,
  projectName: string,
  showClosedTodos: boolean,
) => {
  const queryClient = useQueryClient()

  const issuesRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "issues", showClosedTodos],
    queryFn: () =>
      ProjectsService.getProjectIssues({
        ownerName: accountName,
        projectName: projectName,
        state: showClosedTodos ? "all" : "open",
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
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["projects", accountName, projectName, "issues"],
      }),
  })

  return { issueStateMutation, issuesRequest }
}

export {
  useProjectFiles,
  useProjectFigures,
  useProjectPublications,
  useProjectReadme,
  useProjectDatasets,
  useProjectEnvironments,
  useProjectIssues,
  useProjectQuestions,
}
export default useProject
