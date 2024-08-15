import { Container, Flex } from "@chakra-ui/react"
import { createFileRoute, Outlet } from "@tanstack/react-router"

import Sidebar from "../../../../components/Common/Sidebar"

export const Route = createFileRoute("/_layout/$userName/$projectName/_layout")(
  {
    component: ProjectLayout,
  },
)

function ProjectLayout() {
  const { userName, projectName } = Route.useParams()

  return (
    <Flex>
      <Sidebar basePath={`/${userName}/${projectName}`} />
      <Container maxW="full" mx={6}>
        <Outlet />
      </Container>
    </Flex>
  )
}
