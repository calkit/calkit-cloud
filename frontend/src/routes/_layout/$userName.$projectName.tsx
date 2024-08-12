import { Box, Container, Heading, Spinner, Flex } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ProjectsService, type Project } from "../../client"

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
          <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
            {project?.name}
          </Heading>
          <Box pt={5}>{project?.git_repo_url}</Box>
        </Box>
      )}
    </>
  )
}

function Project() {
  return (
    <Container maxW="full">
      <ProjectView />
    </Container>
  )
}
