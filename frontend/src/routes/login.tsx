import { Button, Container, Image, Text, Link } from "@chakra-ui/react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import Logo from "/assets/images/calkit-no-bg.svg"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import { z } from "zod"
import { useEffect, useRef } from "react"
import mixpanel from "mixpanel-browser"

const githubAuthParamsSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
})

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  validateSearch: (search) => githubAuthParamsSchema.parse(search),
})

function Login() {
  const { loginGitHubMutation } = useAuth()
  const { code: ghAuthCode, state: ghAuthStateRecv } = Route.useSearch()
  const isMounted = useRef(false)

  const clientId = import.meta.env.VITE_GH_CLIENT_ID
  const ghAuthStateParam = "sdkjh4e0934t" // TODO: Generate randomly

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      if (ghAuthCode && ghAuthStateRecv === ghAuthStateParam) {
        try {
          loginGitHubMutation.mutate(ghAuthCode)
        } catch {
          // Error should be handled in the mutation
        }
      } else if (ghAuthCode && ghAuthStateRecv != ghAuthStateParam) {
        console.error(
          `Received state parameter does not match sent (${ghAuthStateParam})`,
        )
      }
    }
  }, [])

  const handleLoginClicked = () => {
    mixpanel.track("Clicked login")
    location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${ghAuthStateParam}`
  }

  return (
    <>
      <Container
        h="100vh"
        maxW="xs"
        justifyContent="center"
        gap={4}
        centerContent
      >
        <Image
          src={Logo}
          alt="Logo"
          height="150px"
          alignSelf="center"
          mb={-12}
        />
        <Text mb={3} fontSize="md">
          Reproducibility simplified
        </Text>
        <Button
          variant="primary"
          isLoading={loginGitHubMutation.isPending}
          onClick={handleLoginClicked}
        >
          Sign in with GitHub
        </Button>
        <Text fontSize={10} mt={1}>
          <Link isExternal variant="default" href="https://calkit.org">
            Learn more
          </Link>
        </Text>
      </Container>
    </>
  )
}
