import { createFileRoute } from "@tanstack/react-router"
import { Box, Flex, Spinner } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"

import Mermaid from "../../../../../components/Common/Mermaid"
import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/workflow",
)({
  component: ProjectWorkflow,
})

function ProjectWorkflow() {
  const { userName, projectName } = Route.useParams()
  const workflowQuery = useQuery({
    queryKey: [userName, projectName, "workflow"],
    queryFn: () =>
      ProjectsService.getProjectWorkflow({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  console.log(workflowQuery.data)

  return (
    <>
      <Box>
        This page is dedicated to describing this project's workflow. The
        workflow describes the steps that produce various artifacts, e.g.,
        datasets, figures, publications.
      </Box>
      {workflowQuery.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box p={5}>
          <Mermaid>{String(workflowQuery?.data?.mermaid)}</Mermaid>
        </Box>
      )}
    </>
  )
}
