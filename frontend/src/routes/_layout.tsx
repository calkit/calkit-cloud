import { Flex, Spinner, Box, Container, Link, Button } from "@chakra-ui/react"
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import mixpanel from "mixpanel-browser"

import useAuth from "../hooks/useAuth"
import Topbar from "../components/Common/Topbar"
import PickSubscription from "../components/UserSettings/PickSubscription"
import { UsersService } from "../client"

export const Route = createFileRoute("/_layout")({
  component: Layout,
})

function InstallGitHubApp() {
  const appNameBase = "calkit"
  const apiUrl = String(import.meta.env.VITE_API_URL)
  const getAppName = () => {
    if (apiUrl.includes("localhost")) {
      return appNameBase + "-dev"
    }
    if (apiUrl.includes("staging")) {
      return appNameBase + "-staging"
    }
    return appNameBase
  }
  return (
    <>
      <Flex height="100vh" width="full" justify="center" align="center">
        <Link
          href={`https://github.com/apps/${getAppName()}/installations/new`}
        >
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
  const appNameBase = "calkit"
  const apiUrl = String(import.meta.env.VITE_API_URL)
  const getAppName = () => {
    if (apiUrl.includes("localhost")) {
      return appNameBase + "-dev"
    }
    if (apiUrl.includes("staging")) {
      return appNameBase + "-staging"
    }
    return appNameBase
  }
  if (ghAppInstalledQuery.error) {
    logout()
  }
  // Check that the user has at least one installation
  const ghAppNotInstalled =
    user && ghAppInstalledQuery.data && !ghAppInstalledQuery.data.total_count
  if (ghAppNotInstalled) {
    location.href = `https://github.com/apps/${getAppName()}/installations/new`
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
