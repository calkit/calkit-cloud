import { Box, Heading, Spinner, Flex, Text, Code } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/figures",
)({
  component: ProjectFigures,
})

function ProjectFiguresView() {
  const { userName, projectName } = Route.useParams()
  const { isPending: figuresPending, data: figures } = useQuery({
    queryKey: ["projects", userName, projectName, "figures"],
    queryFn: () =>
      ProjectsService.getProjectFigures({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {figuresPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          {figures?.map((figure) => (
            <Box key={figure.title}>
              <Heading size="md">{figure.title}</Heading>
              <Code>{figure.path}</Code>
              <Text>{figure.description}</Text>
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

function ProjectFigures() {
  return <ProjectFiguresView />
}
