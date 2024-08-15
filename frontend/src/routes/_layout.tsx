import { Flex, Spinner, Box, Container } from "@chakra-ui/react"
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import Topbar from "../components/Common/Topbar"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const { isLoading } = useAuth()

  return (
    <Box>
      <Topbar />
      {isLoading ? (
        <Flex justify="center" align="center" height="90%" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Container px={0} maxW="full">
          <Outlet />
        </Container>
      )}
    </Box>
  )
}
