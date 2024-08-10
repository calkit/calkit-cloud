import { Button, Container, Image } from "@chakra-ui/react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import Logo from "/assets/images/kdot.svg"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import { z } from "zod"
import { useEffect } from "react"

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

  const clientId = "Iv23li37fyOhqbAYUDZ1"
  const ghAuthStateParam = "dfjkhskdjfhsdf" // TODO: Generate random and store

  const { code: ghAuthCode, state: ghAuthStateRecv } = Route.useSearch()

  useEffect(() => {
    if (ghAuthCode != undefined && ghAuthStateRecv === ghAuthStateParam) {
      try {
        loginGitHubMutation.mutate(ghAuthCode)
      } catch {
        // Error should be handled in the mutation
      }
    }
  }, [loginGitHubMutation])

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
