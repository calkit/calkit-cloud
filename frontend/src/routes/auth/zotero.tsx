import { Container, Text } from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { useEffect, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { UsersService, type ApiError } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"

// Zotero uses OAuth 1.0a, so it sends back a verifier rather than a code, and
// the request token it was issued against stands in for a state parameter.
// Zotero omits the verifier when the user declines.
const authParamsSchema = z.object({
  oauth_token: z.string(),
  oauth_verifier: z.string().optional(),
})

export const Route = createFileRoute("/auth/zotero")({
  component: ZoteroAuth,
  validateSearch: (search) => authParamsSchema.parse(search),
})

function ZoteroAuth() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const showToast = useCustomToast()
  const zoteroAuthMutation = useMutation({
    mutationFn: ({
      oauthToken,
      oauthVerifier,
    }: {
      oauthToken: string
      oauthVerifier: string
    }) =>
      UsersService.postUserZoteroAuth({
        requestBody: {
          oauth_token: oauthToken,
          oauth_verifier: oauthVerifier,
        },
      }),
    onSuccess: () => {
      showToast("Success!", "Zotero account connected successfully.", "success")
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
  const { oauth_token: oauthToken, oauth_verifier: oauthVerifier } =
    Route.useSearch()
  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      if (oauthToken && oauthVerifier) {
        try {
          zoteroAuthMutation.mutate({ oauthToken, oauthVerifier })
        } catch {
          // Error should be handled in the mutation
        }
      } else {
        showToast(
          "Not connected",
          "Zotero access was not granted. Please try again.",
          "error",
        )
        navigate({ to: "/settings", search: { tab: "profile" } })
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
          {zoteroAuthMutation.isPending
            ? "Authenticating with Zotero..."
            : "Done"}
        </Text>
      </Container>
    </>
  )
}
