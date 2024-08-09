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
        position="fixed"
        top={4}
        left={4}
        alignItems="baseline"
        h={8}
      >
        <Link as={RouterLink} to="/">
          <Image
            width={20}
            src="/assets/images/calkit.svg"
            alt="Calkit logo"
          ></Image>
        </Link>
      </Box>
      {/* TODO: Add other menu items, e.g.:
      https://chakra-templates.vercel.app/navigation/navbar */}
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Container maxW="85%" pt={15} mt={5}>
          <Outlet />
        </Container>
      )}
      <UserMenu />
    </Flex>
  )
}
