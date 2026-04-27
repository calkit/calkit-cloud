import {
  Button,
  Container,
  Heading,
  Text,
  VStack,
  Alert,
  AlertIcon,
  Code,
} from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { LoginService, type ApiError } from "../client"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import useCustomToast from "../hooks/useCustomToast"
import { handleError } from "../lib/errors"

const cliAuthParamsSchema = z.object({
  device_code: z.string(),
})

export const Route = createFileRoute("/cli-auth")({
  component: CliAuth,
  validateSearch: (search) => cliAuthParamsSchema.parse(search),
})

function CliAuth() {
  const { device_code } = Route.useSearch()
  const { user } = useAuth()
  const navigate = useNavigate()
  const showToast = useCustomToast()
  const [authorized, setAuthorized] = useState(false)

  const authorizeMutation = useMutation({
    mutationFn: () =>
      LoginService.postLoginDeviceAuthorize({
        requestBody: { device_code },
      }),
    onSuccess: () => {
      setAuthorized(true)
      showToast(
        "Authorized!",
        "Your CLI has been authorized. You can close this window.",
        "success",
      )
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
  })

  const handleLoginRedirect = () => {
    localStorage.setItem(
      "post_login_redirect",
      `/cli-auth?device_code=${device_code}`,
    )
    navigate({ to: "/login" })
  }

  if (!isLoggedIn() || !user) {
    return (
      <Container
        h="100vh"
        maxW="sm"
        alignItems="stretch"
        justifyContent="center"
        gap={4}
        centerContent
      >
        <VStack spacing={4} align="stretch">
          <Heading size="md" textAlign="center">
            Authorize CLI Access
          </Heading>
          <Text textAlign="center">
            You need to be logged in to authorize CLI access.
          </Text>
          <Button variant="primary" onClick={handleLoginRedirect}>
            Log in to authorize
          </Button>
        </VStack>
      </Container>
    )
  }

  if (authorized) {
    return (
      <Container
        h="100vh"
        maxW="sm"
        alignItems="stretch"
        justifyContent="center"
        gap={4}
        centerContent
      >
        <VStack spacing={4} align="stretch">
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            CLI access authorized! You can close this window and return to your
            terminal.
          </Alert>
        </VStack>
      </Container>
    )
  }

  return (
    <Container
      h="100vh"
      maxW="sm"
      alignItems="stretch"
      justifyContent="center"
      gap={4}
      centerContent
    >
      <VStack spacing={4} align="stretch">
        <Heading size="md" textAlign="center">
          Authorize CLI Access
        </Heading>
        <Text>
          Logged in as <Code>{user.github_username || user.email}</Code>
        </Text>
        <Text>
          A Calkit CLI is requesting access to your account. Click the button
          below to authorize it. A long-lived access token will be created and
          sent to the CLI.
        </Text>
        <Button
          variant="primary"
          isLoading={authorizeMutation.isPending}
          onClick={() => authorizeMutation.mutate()}
        >
          Authorize CLI
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/" })}
          isDisabled={authorizeMutation.isPending}
        >
          Cancel
        </Button>
      </VStack>
    </Container>
  )
}
