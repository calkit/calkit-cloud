import { Box, Heading, Spinner, Flex, Text, Code } from "@chakra-ui/react"
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
  const { isPending: dataPending, data: datasets } = useQuery({
    queryKey: ["projects", userName, projectName, "datasets"],
    queryFn: () =>
      ProjectsService.getProjectDatasets({
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
            <Box key={dataset.path}>
              <Heading fontFamily="monospace" size="md" pb={1}>
                {dataset.path}
              </Heading>
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
