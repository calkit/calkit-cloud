import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  UnorderedList,
  ListItem,
  Code,
  Badge,
} from "@chakra-ui/react"
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
      ProjectsService.getProjectData({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      <Heading size="md" mb={2}>
        Data
      </Heading>
      {dataPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <UnorderedList>
            {datasets?.map((dataset) => (
              <ListItem key={dataset.path}>
                <Code>{dataset.path}</Code>
                {dataset.imported_from ? (
                  <Badge ml={1} bgColor="green.500">
                    imported
                  </Badge>
                ) : (
                  ""
                )}
                <Text>Title: {dataset.title ? dataset.title : ""}</Text>
                <Text>
                  Description: {dataset.description ? dataset.description : ""}
                </Text>
              </ListItem>
            ))}
          </UnorderedList>
        </Box>
      )}
    </>
  )
}

function ProjectData() {
  return <ProjectDataView />
}
