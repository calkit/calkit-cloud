import { Flex, Spinner, Box, Container, Link, Button } from "@chakra-ui/react"
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import mixpanel from "mixpanel-browser"

import useAuth from "../hooks/useAuth"
import Topbar from "../components/Common/Topbar"
import PickSubscription from "../components/UserSettings/PickSubscription"
import { UsersService } from "../client"
import { appName } from "../lib/core"

export const Route = createFileRoute("/_layout")({
  component: Layout,
})

function InstallGitHubApp() {
  return (
    <>
      <Flex height="100vh" width="full" justify="center" align="center">
        <Link href={`https://github.com/apps/${appName}/installations/new`}>
          <Button variant={"primary"}>Add the Calkit app to GitHub</Button>
        </Link>
      </Flex>
    </>
  )
}

function Layout() {
  const { isLoading, user, logout } = useAuth()
  if (user) {
    mixpanel.identify(user.id)
    mixpanel.people.set({
      $name: user.full_name,
      $email: user.email,
      $github_username: user.github_username,
      $plan_name: user.subscription?.plan_name,
    })
  }
  const ghAppInstalledQuery = useQuery({
    queryKey: ["user", "github-app-installations"],
    queryFn: () => UsersService.getUserGithubAppInstallations(),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: () => Boolean(user),
    retry: 1,
  })
  if (ghAppInstalledQuery.error) {
    const status =
      (ghAppInstalledQuery.error as any)?.status ??
      (ghAppInstalledQuery.error as any)?.response?.status
    const detail =
      (ghAppInstalledQuery.error as any)?.body?.detail ??
      (ghAppInstalledQuery.error as any)?.response?.data?.detail
    const isAuthError =
      status === 401 ||
      status === 403 ||
      detail === "Token has expired" ||
      detail === "Invalid token" ||
      detail === "Could not validate credentials"

    if (isAuthError) {
      logout()
    }
  }
  // Check that the user has at least one installation
  const ghAppNotInstalled =
    user && ghAppInstalledQuery.data && !ghAppInstalledQuery.data.total_count
  if (ghAppNotInstalled) {
    location.href = `https://github.com/apps/${appName}/installations/new`
  }

  return (
    <Box>
      {isLoading || (user && ghAppInstalledQuery.isPending) ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <>
          {ghAppNotInstalled ? (
            <InstallGitHubApp />
          ) : (
            <>
              {/* If the user doesn't have a subscription, they need to pick one */}
              {!user || user?.subscription ? (
                <Box>
                  <Topbar />
                  <Container px={0} maxW="full">
                    <Outlet />
                  </Container>
                </Box>
              ) : (
                <PickSubscription
                  user={user}
                  containerProps={{
                    display: "flex",
                    alignItems: "center",
                    alignContent: "center",
                    justifyContent: "center",
                    height: "100vh",
                    width: "full",
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </Box>
  )
}
