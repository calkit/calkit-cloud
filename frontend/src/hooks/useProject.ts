import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ProjectsService } from "../client"

const useProject = (
  userName: string,
  projectName: string,
  showClosedTodos: boolean,
) => {
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

  const readmeRequest = useQuery({
    queryKey: ["projects", userName, projectName, "readme"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: "README.md",
      }),
  })

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
    readmeRequest,
    issuesRequest,
    questionsRequest,
    reproCheckRequest,
    showcaseRequest,
    issueStateMutation,
    putDevcontainerMutation,
  }
}

export default useProject
