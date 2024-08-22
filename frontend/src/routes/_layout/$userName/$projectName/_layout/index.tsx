import { Box, Spinner, Flex } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ProjectsService } from "../../../../../client"
import Markdown from "../../../../../components/Common/Markdown"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/",
)({
  component: Project,
})

function ProjectView() {
  const { userName, projectName } = Route.useParams()
  const readmeRequest = useQuery({
    queryKey: ["projects", userName, projectName, "readme"],
    queryFn: () =>
      ProjectsService.getProjectGitContents1({
        ownerName: userName,
        projectName: projectName,
        path: "README.md",
        astype: ".raw",
      }),
  })

  const removeFirstLine = (txt: any) => {
    let lines = String(txt).split("\n")
    lines.splice(0, 1)
    return lines.join("\n")
  }

  return (
    <>
      {readmeRequest.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <Markdown>{removeFirstLine(readmeRequest.data)}</Markdown>
        </Box>
      )}
    </>
  )
}

function Project() {
  return <ProjectView />
}
