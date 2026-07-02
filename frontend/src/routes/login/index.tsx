import { Button, Container, Image, Text, Link } from "@chakra-ui/react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { z } from "zod"
import { useEffect, useRef } from "react"
import mixpanel from "mixpanel-browser"
import { FaGithub } from "react-icons/fa"

import Logo from "/assets/images/calkit-no-bg.svg"
import useAuth, { isLoggedIn } from "../../hooks/useAuth"
import { popPostLoginRedirect } from "../../lib/auth"

const githubAuthParamsSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
})

export const Route = createFileRoute("/login/")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      const stored = popPostLoginRedirect()
      throw redirect({ to: stored || "/" })
    }
  },
  validateSearch: (search) => githubAuthParamsSchema.parse(search),
})

const OAUTH_STATE_KEY = "gh_oauth_state"

function generateOAuthState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

function Login() {
  const { loginGitHubMutation } = useAuth()
  const { code: ghAuthCode, state: ghAuthStateRecv } = Route.useSearch()
  const isMounted = useRef(false)

  const clientId = import.meta.env.VITE_GH_CLIENT_ID
  const getGitHubRedirectUri = () => {
    const baseUrl =
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      window.location.origin
    return `${baseUrl}/login`
  }

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      if (ghAuthCode) {
        const storedState = sessionStorage.getItem(OAUTH_STATE_KEY)
        sessionStorage.removeItem(OAUTH_STATE_KEY)
        if (ghAuthStateRecv && storedState && ghAuthStateRecv === storedState) {
          try {
            loginGitHubMutation.mutate({
              code: ghAuthCode,
              redirectUri: getGitHubRedirectUri(),
            })
          } catch {
            // Error should be handled in the mutation
          }
        } else {
          console.error("OAuth state mismatch — possible CSRF attempt")
        }
      }
    }
  }, [])

  const handleLoginClicked = () => {
    mixpanel.track("Clicked login")
    const state = generateOAuthState()
    sessionStorage.setItem(OAUTH_STATE_KEY, state)
    location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${state}`
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
          mb={-9}
        />
        <Button
          variant="primary"
          isLoading={loginGitHubMutation.isPending}
          onClick={handleLoginClicked}
          rightIcon={<FaGithub />}
        >
          Sign in with GitHub
        </Button>
        <Text fontSize={10} mt={-1}>
          <Link isExternal variant="default" href="https://calkit.org">
            Learn more
          </Link>
        </Text>
      </Container>
    </>
  )
}
