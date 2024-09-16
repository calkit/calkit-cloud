import {
  TableContainer,
  Table,
  Thead,
  Th,
  Tr,
  Td,
  Tbody,
  SkeletonText,
  Checkbox,
} from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { UsersService, type TokenPatch } from "../../client"

function UserTokens() {
  const queryClient = useQueryClient()
  const tokensQuery = useQuery({
    queryKey: ["user", "tokens"],
    queryFn: () => UsersService.getUserTokens(),
  })
  interface TokenIsActive {
    tokenId: string
    tokenPatch: TokenPatch
  }
  const tokenActiveMutation = useMutation({
    mutationFn: ({ tokenId, tokenPatch }: TokenIsActive) =>
      UsersService.patchUserToken({
        requestBody: tokenPatch,
        tokenId: tokenId,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["user", "tokens"] }),
  })

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Created</Th>
              <Th>Expires</Th>
              <Th>Scope</Th>
              <Th>Active</Th>
            </Tr>
          </Thead>
          {tokensQuery.isPending || tokenActiveMutation.isPending ? (
            <Tbody>
              <Tr>
                {new Array(5).fill(null).map((_, index) => (
                  <Td key={index}>
                    <SkeletonText noOfLines={1} paddingBlock="16px" />
                  </Td>
                ))}
              </Tr>
            </Tbody>
          ) : (
            <Tbody>
              {tokensQuery.data?.map((token) => (
                <Tr
                  key={token.id}
                  opacity={tokensQuery.isPlaceholderData ? 0.5 : 1}
                >
                  <Td isTruncated maxWidth="150px">
                    {token.id}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    {token.created}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    {token.expires}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    {token.scope ? token.scope : ""}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Checkbox
                      isChecked={token.is_active}
                      isDisabled={tokenActiveMutation.isPending}
                      onChange={(e) =>
                        tokenActiveMutation.mutate({
                          tokenId: String(token.id),
                          tokenPatch: { is_active: e.target.checked },
                        })
                      }
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          )}
        </Table>
      </TableContainer>
    </>
  )
}

export default UserTokens
