import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  ListItem,
  OrderedList,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"

import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/",
)({
  component: Project,
})

function ProjectView() {
  const { userName, projectName } = Route.useParams()
  const { isPending, data: project } = useQuery({
    queryKey: ["projects", userName, projectName],
    queryFn: () =>
      ProjectsService.getProjectByName({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const {
    isPending: localServerPending,
    error: localServerError,
    data: localServerData,
  } = useQuery({
    queryKey: ["local-server-health"],
    queryFn: () => axios.get("http://localhost:8866/health"),
  })

  return (
    <>
      {isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <Box>{project?.git_repo_url}</Box>
          <Text>Project type: Research</Text>
          <Text>Project type: Sup</Text>
          <Box>
            <Text>
              {localServerError || localServerPending
                ? "Local server not connected"
                : `Local server ${String(localServerData.data).toLowerCase()}`}
            </Text>
          </Box>
          <Heading size="md" pt={4} pb={2}>
            Questions
          </Heading>
          <OrderedList>
            <ListItem>
              Are there new terms we can add to the RANS equations, derived from
              existing quantities, which close the equations?
            </ListItem>
            <ListItem>
              If so, can we discover the coefficients for those new quantities
              from DNS data?
            </ListItem>
          </OrderedList>
          <Heading size="md" pt={4} pb={2}>
            Readme
          </Heading>
        </Box>
      )}
    </>
  )
}

function Project() {
  return <ProjectView />
}
