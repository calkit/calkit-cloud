import { Container, Text } from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { useEffect, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { UsersService } from "../client"
import { getZenodoRedirectUri, zenodoAuthStateParam } from "../utils"

const authParamsSchema = z.object({
  code: z.string(),
  state: z.string(),
})

export const Route = createFileRoute("/zenodo-auth")({
  component: ZenodoAuth,
  validateSearch: (search) => authParamsSchema.parse(search),
})

function ZenodoAuth() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const zenodoAuthMutation = useMutation({
    mutationFn: (code: string) =>
      UsersService.postUserZenodoAuth({
        code: code,
        redirectUri: getZenodoRedirectUri(),
      }),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["user", "connected-accounts"],
      })
      navigate({ to: "/settings", search: { tab: "profile" } })
    },
  })
  const { code: zenodoAuthCode, state: zenodoAuthStateRecv } = Route.useSearch()
  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      if (zenodoAuthCode && zenodoAuthStateRecv === zenodoAuthStateParam) {
        try {
          zenodoAuthMutation.mutate(zenodoAuthCode)
        } catch {
          // Error should be handled in the mutation
        }
      } else if (
        zenodoAuthCode &&
        zenodoAuthStateRecv !== zenodoAuthStateParam
      ) {
        console.error(
          `Received state parameter does not match sent (${zenodoAuthStateParam})`,
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
          {zenodoAuthMutation.isPending
            ? "Authenticating with Zenodo..."
            : "Done"}
        </Text>
      </Container>
    </>
  )
}
