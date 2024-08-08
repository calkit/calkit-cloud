import { Box, Container, Heading, Spinner, Flex } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ProjectsService } from "../../client"

export const Route = createFileRoute("/_layout/$userName/$projectName")({
  component: Project,
})

function ProjectView() {
  const { isPending, data: project } = useQuery({
    queryKey: ["projects", "d57bda04-0f73-46d8-a465-3b3663856dc8"],
    queryFn: () =>
      ProjectsService.getProject({
        projectId: "d57bda04-0f73-46d8-a465-3b3663856dc8",
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
