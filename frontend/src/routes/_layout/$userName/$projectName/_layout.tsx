import { Container, Flex, Spinner } from "@chakra-ui/react"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

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
  const { isPending, error } = useQuery({
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
            <Outlet />
          </Container>
        </Flex>
      )}
    </>
  )
}
