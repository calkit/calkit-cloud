import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ProjectsService } from "../client"

const useProject = (userName: string, projectName: string) => {
  const queryClient = useQueryClient()

  const projectRequest = useQuery({
    queryKey: ["projects", userName, projectName],
    queryFn: () =>
      ProjectsService.getProject({
        ownerName: userName,
        projectName: projectName,
      }),
    retry: (failureCount, error) => {
      if (error.message === "Not Found" || error.message === "Forbidden") {
        return false
      }
      return failureCount < 3
    },
  })

  const userHasWriteAccess = ["owner", "admin", "write"].includes(
    String(projectRequest.data?.current_user_access),
  )

  const questionsRequest = useQuery({
    queryKey: ["projects", userName, projectName, "questions"],
    queryFn: () =>
      ProjectsService.getProjectQuestions({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  const reproCheckRequest = useQuery({
    queryKey: ["projects", userName, projectName, "repro-check"],
    queryFn: () =>
      ProjectsService.getProjectReproCheck({
        ownerName: userName,
        projectName: projectName,
      }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const showcaseRequest = useQuery({
    queryKey: ["projects", userName, projectName, "showcase"],
    queryFn: () =>
      ProjectsService.getProjectShowcase({
        ownerName: userName,
        projectName: projectName,
      }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const putDevcontainerMutation = useMutation({
    mutationFn: () =>
      ProjectsService.putProjectDevContainer({
        ownerName: userName,
        projectName: projectName,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["projects", userName, projectName, "repro-check"],
      }),
  })

  return {
    projectRequest,
    userHasWriteAccess,
    questionsRequest,
    reproCheckRequest,
    showcaseRequest,
    putDevcontainerMutation,
  }
}

const useProjectReadme = (userName: string, projectName: string) => {
  const readmeRequest = useQuery({
    queryKey: ["projects", userName, projectName, "readme"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: "README.md",
      }),
  })
  return { readmeRequest }
}

const useProjectFigures = (userName: string, projectName: string) => {
  const figuresRequest = useQuery({
    queryKey: ["projects", userName, projectName, "figures"],
    queryFn: () =>
      ProjectsService.getProjectFigures({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  return { figuresRequest }
}

const useProjectFiles = (userName: string, projectName: string) => {
  const filesRequest = useQuery({
    queryKey: ["projects", userName, projectName, "files"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  return { filesRequest }
}

const useProjectDatasets = (userName: string, projectName: string) => {
  const datasetsRequest = useQuery({
    queryKey: ["projects", userName, projectName, "datasets"],
    queryFn: () =>
      ProjectsService.getProjectDatasets({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return { datasetsRequest }
}

const useProjectPublications = (userName: string, projectName: string) => {
  const publicationsRequest = useQuery({
    queryKey: ["projects", userName, projectName, "publications"],
    queryFn: () =>
      ProjectsService.getProjectPublications({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  return { publicationsRequest }
}

const useProjectIssues = (
  userName: string,
  projectName: string,
  showClosedTodos: boolean,
) => {
  const queryClient = useQueryClient()

  const issuesRequest = useQuery({
    queryKey: ["projects", userName, projectName, "issues", showClosedTodos],
    queryFn: () =>
      ProjectsService.getProjectIssues({
        ownerName: userName,
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
        ownerName: userName,
        projectName: projectName,
        issueNumber: data.issueNumber,
        requestBody: { state: data.state },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["projects", userName, projectName, "issues"],
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
  useProjectIssues,
}
export default useProject
