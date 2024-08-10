import { Button, Container, Image } from "@chakra-ui/react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import Logo from "/assets/images/kdot.svg"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import { z } from "zod"
import { useEffect, useRef } from "react"

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

  const clientId = "Iv23li37fyOhqbAYUDZ1"
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

  return (
    <>
      <Container
        h="100vh"
        maxW="xs"
        alignItems="stretch"
        justifyContent="center"
        gap={4}
        centerContent
      >
        <Image
          src={Logo}
          alt="Logo"
          height="10%"
          maxW="2xs"
          alignSelf="center"
          mb={4}
        />
        <Button
          variant="primary"
          onClick={() =>
            (location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${ghAuthStateParam}`)
          }
        >
          Sign in with GitHub
        </Button>
      </Container>
    </>
  )
}
