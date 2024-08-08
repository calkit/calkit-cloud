import { Flex, Spinner, Box, Link, Image, Container } from "@chakra-ui/react"
import {
  Outlet,
  createFileRoute,
  redirect,
  Link as RouterLink,
} from "@tanstack/react-router"
import UserMenu from "../components/Common/UserMenu"
import useAuth, { isLoggedIn } from "../hooks/useAuth"

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
    <Flex maxW="large" h="auto" position="relative">
      <Box
        display="block"
        position="relative"
        top={4}
        left={4}
        alignItems="baseline"
        h={20}
      >
        <Link as={RouterLink} to="/">
          <Image
            width={20}
            src="/assets/images/calkit.svg"
            alt="Calkit logo"
          ></Image>
        </Link>
      </Box>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Container maxW="88%" pt={10}>
          <Outlet />
        </Container>
      )}
      <UserMenu />
      {/* TODO: Show the logo in the upper left */}
    </Flex>
  )
}
