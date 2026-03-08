import { Container, Text } from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { useEffect, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { UsersService, type ApiError } from "../client"
import { getGoogleRedirectUri, googleAuthStateParam } from "../lib/google"
import useCustomToast from "../hooks/useCustomToast"
import { handleError } from "../lib/errors"

const authParamsSchema = z.object({
  code: z.string(),
  state: z.string(),
  scope: z.string().optional(),
  iss: z.string().optional(),
})

export const Route = createFileRoute("/google-auth")({
  component: GoogleAuth,
  validateSearch: (search) => authParamsSchema.parse(search),
})

function GoogleAuth() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const showToast = useCustomToast()
  const googleAuthMutation = useMutation({
    mutationFn: (code: string) =>
      UsersService.postUserGoogleAuth({
        code: code,
        redirectUri: getGoogleRedirectUri(),
      }),
    onSuccess: () => {
      showToast("Success!", "Google account connected successfully.", "success")
      queryClient.invalidateQueries({
        queryKey: ["user", "connected-accounts"],
      })
      navigate({ to: "/settings", search: { tab: "profile" } })
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
      // Still navigate back after showing error
      setTimeout(() => {
        navigate({ to: "/settings", search: { tab: "profile" } })
      }, 2000)
    },
  })
  const { code: googleAuthCode, state: googleAuthStateRecv } = Route.useSearch()
  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      if (googleAuthCode && googleAuthStateRecv === googleAuthStateParam) {
        try {
          googleAuthMutation.mutate(googleAuthCode)
        } catch {
          // Error should be handled in the mutation
        }
      } else if (
        googleAuthCode &&
        googleAuthStateRecv !== googleAuthStateParam
      ) {
        console.error(
          `Received state parameter does not match sent (${googleAuthStateParam})`,
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
        <Text>
          {googleAuthMutation.isPending
            ? "Authenticating with Google..."
            : "Done"}
        </Text>
      </Container>
    </>
  )
}
