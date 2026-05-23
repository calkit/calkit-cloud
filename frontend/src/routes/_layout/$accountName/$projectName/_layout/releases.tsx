import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Heading,
  Icon,
  IconButton,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useClipboard,
  useDisclosure,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { FaPlus, FaTrash } from "react-icons/fa"
import { FiCopy, FiExternalLink } from "react-icons/fi"

import { type ReleaseListItem, ReleasesService } from "../../../../../client"
import type { ApiError } from "../../../../../client/core/ApiError"
import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import NewRelease from "../../../../../components/Releases/NewRelease"
import useCustomToast from "../../../../../hooks/useCustomToast"
import useProject from "../../../../../hooks/useProject"
import { handleError } from "../../../../../lib/errors"
import { releaseUrl } from "../../../../../lib/releases"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/releases",
)({
  component: Releases,
})

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "—"
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString()
}

const CopyLinkButton = ({ token }: { token: string }) => {
  const { onCopy, hasCopied } = useClipboard(releaseUrl(token))
  return (
    <Tooltip label={hasCopied ? "Copied!" : "Copy link"}>
      <IconButton
        aria-label="Copy link"
        icon={<FiCopy />}
        size="xs"
        variant="ghost"
        onClick={onCopy}
      />
    </Tooltip>
  )
}

function Releases() {
  const { accountName, projectName } = Route.useParams()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layoutSearch = useSearch({
    from: "/_layout/$accountName/$projectName/_layout" as any,
    strict: false,
  }) as any
  const ref: string | undefined = layoutSearch?.ref
  const { userHasWriteAccess } = useProject(accountName, projectName)
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const newReleaseModal = useDisclosure()
  const confirmDelete = useDisclosure()
  const [toDelete, setToDelete] = useState<ReleaseListItem | null>(null)

  const releasesQuery = useQuery({
    queryKey: ["projects", accountName, projectName, "releases", ref],
    queryFn: () =>
      ReleasesService.getProjectReleases({
        ownerName: accountName,
        projectName,
        ref,
      }),
  })
  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      ReleasesService.deleteProjectRelease({
        ownerName: accountName,
        projectName,
        releaseName: name,
      }),
    onSuccess: () => {
      showToast("Success", "Release deleted.", "success")
      confirmDelete.onClose()
      setToDelete(null)
    },
    onError: (err: ApiError) => handleError(err, showToast),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", accountName, projectName, "releases"],
      })
    },
  })
  const releases = releasesQuery.data ?? []

  return (
    <Box px={4} py={2} w="100%">
      <Flex align="center" mb={4}>
        <Heading size="lg">Releases</Heading>
        {userHasWriteAccess && (
          <Button
            variant="primary"
            size="sm"
            ml={4}
            leftIcon={<Icon as={FaPlus} />}
            onClick={newReleaseModal.onOpen}
          >
            New release
          </Button>
        )}
      </Flex>
      {releasesQuery.isPending ? (
        <LoadingSpinner height="200px" />
      ) : releases.length === 0 ? (
        <Flex align="center" justify="center" h="160px" color="gray.500">
          <Text>
            No releases yet.
            {userHasWriteAccess
              ? " Create one to share a versioned artifact via a secret link."
              : ""}
          </Text>
        </Flex>
      ) : (
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Path</Th>
                <Th>Version</Th>
                <Th>Date</Th>
                <Th>Visibility</Th>
                <Th isNumeric>Views</Th>
                <Th isNumeric>Comments</Th>
                <Th>Link / DOI</Th>
                {userHasWriteAccess && <Th />}
              </Tr>
            </Thead>
            <Tbody>
              {releases.map((r) => (
                <Tr key={`${r.source}-${r.name}`}>
                  <Td fontWeight="semibold">{r.name}</Td>
                  <Td>
                    <Text noOfLines={1} maxW="180px">
                      {r.path && r.path !== "." ? r.path : "(whole project)"}
                    </Text>
                  </Td>
                  <Td>
                    <Code fontSize="xs">
                      {r.git_ref ?? r.git_rev_abbrev ?? "—"}
                    </Code>
                  </Td>
                  <Td whiteSpace="nowrap">{formatDate(r.date)}</Td>
                  <Td>
                    <Badge colorScheme={r.public ? "green" : "gray"}>
                      {r.public ? "Public" : "Private"}
                    </Badge>
                  </Td>
                  <Td isNumeric>{r.view_count != null ? r.view_count : "—"}</Td>
                  <Td isNumeric>
                    {r.comment_count != null ? r.comment_count : "—"}
                  </Td>
                  <Td>
                    {r.source === "cloud" && r.secret_token ? (
                      <HStack spacing={0}>
                        <CopyLinkButton token={r.secret_token} />
                        <Tooltip label="Open">
                          <IconButton
                            as="a"
                            href={releaseUrl(r.secret_token)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open release"
                            icon={<FiExternalLink />}
                            size="xs"
                            variant="ghost"
                          />
                        </Tooltip>
                      </HStack>
                    ) : r.url || r.doi ? (
                      <Link
                        href={r.url ?? `https://doi.org/${r.doi}`}
                        isExternal
                        color="blue.500"
                        fontSize="sm"
                      >
                        {r.doi ?? "Link"} <Icon as={FiExternalLink} mb="-2px" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  {userHasWriteAccess && (
                    <Td>
                      {r.source === "cloud" && (
                        <Tooltip label="Delete">
                          <IconButton
                            aria-label="Delete release"
                            icon={<FaTrash />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => {
                              setToDelete(r)
                              confirmDelete.onOpen()
                            }}
                          />
                        </Tooltip>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
      <NewRelease
        isOpen={newReleaseModal.isOpen}
        onClose={newReleaseModal.onClose}
        ownerName={accountName}
        projectName={projectName}
      />
      <Modal
        isOpen={confirmDelete.isOpen}
        onClose={confirmDelete.onClose}
        isCentered
        size={{ base: "sm", md: "md" }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete release</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Delete release <Code>{toDelete?.name}</Code>? The secret link will
            stop working. This cannot be undone.
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete.name)}
            >
              Delete
            </Button>
            <Button onClick={confirmDelete.onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
