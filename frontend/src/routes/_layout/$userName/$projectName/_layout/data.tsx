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
  // TODO: Replace below with call to fetch data
  const { isPending: dataPending, data: datasets } = useQuery({
    queryKey: ["projects", userName, projectName, "datasets"],
    queryFn: () =>
      ProjectsService.getProjectFigures({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {dataPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
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
