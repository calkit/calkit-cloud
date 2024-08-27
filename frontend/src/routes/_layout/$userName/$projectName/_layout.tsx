import { Container, Flex, Spinner, Heading, Link, Icon } from "@chakra-ui/react"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { FaGithub } from "react-icons/fa"

import Sidebar from "../../../../components/Common/Sidebar"
import NotFound from "../../../../components/Common/NotFound"
import { ProjectsService } from "../../../../client"

export const Route = createFileRoute("/_layout/$userName/$projectName/_layout")(
  {
    component: ProjectLayout,
  },
)

function ProjectLayout() {
  const { userName, projectName } = Route.useParams()
  const {
    isPending,
    error,
    data: project,
  } = useQuery({
    queryKey: ["projects", userName, projectName],
    queryFn: () =>
      ProjectsService.getProjectByName({
        ownerName: userName,
        projectName: projectName,
      }),
    retry: (failureCount, error) => {
      if (error.message === "Not Found") {
        return false
      }
      return failureCount < 3
    },
  })

  if (error?.message === "Not Found") {
    return <NotFound />
  }

  return (
    <>
      {isPending ? (
        <Flex justify="center" align="center" height="90%" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          <Sidebar basePath={`/${userName}/${projectName}`} />
          <Container maxW="full" mx={6}>
            <Flex width={"full"}>
              <Heading
                size="lg"
                textAlign={{ base: "center", md: "left" }}
                alignContent={"center"}
                mt={6}
                mb={3}
              >
                {project?.name}
                {project?.git_repo_url ? (
                  <Link href={project?.git_repo_url} isExternal>
                    <Icon height="45%" as={FaGithub} pl={3} pr={0} mr={0} />
                    <Icon height={"50%"} as={ExternalLinkIcon} pl={0} ml={0} />
                  </Link>
                ) : (
                  ""
                )}
              </Heading>
            </Flex>
            <Outlet />
          </Container>
        </Flex>
      )}
    </>
  )
}
