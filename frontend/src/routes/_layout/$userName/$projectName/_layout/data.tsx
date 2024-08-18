import { Box, Heading, Spinner, Flex, Text } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/data",
)({
  component: ProjectData,
})

function ProjectDataView() {
  const { userName, projectName } = Route.useParams()
  const { isPending, data: project } = useQuery({
    queryKey: ["projects", userName, projectName],
    queryFn: () =>
      ProjectsService.getProjectByName({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  // TODO: Replace below with call to fetch data
  const { isPending: figuresPending, data: datasets } = useQuery({
    queryKey: ["projects", userName, projectName, "figures"],
    queryFn: () =>
      ProjectsService.getProjectFigures({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {isPending || figuresPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <Heading
            size="lg"
            textAlign={{ base: "center", md: "left" }}
            pt={8}
            pb={3}
          >
            Data: {project?.name}
          </Heading>
          {datasets?.map((dataset) => (
            <Box key={dataset.title}>
              <Heading size="md">{dataset.title}</Heading>
              <Text>{dataset.description}</Text>
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

function ProjectData() {
  return <ProjectDataView />
}
