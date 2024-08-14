import {
  Box,
  Container,
  Heading,
  Spinner,
  Flex,
  Text,
  ListItem,
  OrderedList,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ProjectsService } from "../../client"
import Sidebar from "../../components/Common/Sidebar"

export const Route = createFileRoute("/_layout/$userName/$projectName")({
  component: Project,
})

function ProjectView() {
  const { userName, projectName } = Route.useParams()
  const { isPending, data: project } = useQuery({
    queryKey: ["projects", userName, projectName],
    queryFn: () =>
      ProjectsService.getProjectByName({
        ownerUserName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={8}>
            {project?.name}
          </Heading>
          <Box pt={5}>{project?.git_repo_url}</Box>
          <Text>Project type: Research</Text>
          <Text>Project type: Sup</Text>
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
        </Box>
      )}
    </>
  )
}

function Project() {
  return (
    <Flex>
      <Sidebar />
      <Container maxW="full" mx={6}>
        <ProjectView />
      </Container>
    </Flex>
  )
}
