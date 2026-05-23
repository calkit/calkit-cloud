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
import { useState } from "react"
import { FaPlus, FaSort, FaSortDown, FaSortUp, FaTrash } from "react-icons/fa"
import { FiCopy, FiExternalLink } from "react-icons/fi"

import { type ReleaseListItem, ReleasesService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"
import { releaseUrl } from "../../lib/releases"
import LoadingSpinner from "../Common/LoadingSpinner"
import NewRelease from "./NewRelease"

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "—"
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString()
}

export type SortKey =
  | "name"
  | "path"
  | "version"
  | "date"
  | "visibility"
  | "views"
  | "comments"

export type SortDir = "asc" | "desc"

export interface ReleaseSort {
  key: SortKey
  dir: SortDir
}

export const DEFAULT_RELEASE_SORT: ReleaseSort = { key: "date", dir: "desc" }

// Columns that read most naturally as descending on first click.
const DESC_FIRST: Set<SortKey> = new Set(["date", "views", "comments"])

const sortValue = (r: ReleaseListItem, key: SortKey): string | number => {
  switch (key) {
    case "name":
      return r.name.toLowerCase()
    case "path":
      return (r.path && r.path !== "." ? r.path : "").toLowerCase()
    case "version":
      return (r.git_ref ?? r.git_rev_abbrev ?? "").toLowerCase()
    case "date":
      return r.date ? new Date(r.date).getTime() || 0 : 0
    case "visibility":
      return r.public ? 1 : 0
    case "views":
      return r.view_count ?? -1
    case "comments":
      return r.comment_count ?? -1
  }
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

interface ReleasesTableProps {
  ownerName: string
  projectName: string
  userHasWriteAccess: boolean
  // Controlled sort state so it can be persisted (e.g., in URL params).
  sort?: ReleaseSort
  onSortChange?: (sort: ReleaseSort) => void
}

const ReleasesTable = ({
  ownerName,
  projectName,
  userHasWriteAccess,
  sort: sortProp,
  onSortChange,
}: ReleasesTableProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const newReleaseModal = useDisclosure()
  const confirmDelete = useDisclosure()
  const [toDelete, setToDelete] = useState<ReleaseListItem | null>(null)
  // Fall back to internal state when used uncontrolled.
  const [sortState, setSortState] = useState<ReleaseSort>(DEFAULT_RELEASE_SORT)
  const sort = sortProp ?? sortState
  const toggleSort = (key: SortKey) => {
    const next: ReleaseSort =
      sort.key === key
        ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: DESC_FIRST.has(key) ? "desc" : "asc" }
    if (onSortChange) {
      onSortChange(next)
    } else {
      setSortState(next)
    }
  }

  const releasesQuery = useQuery({
    queryKey: ["projects", ownerName, projectName, "releases", undefined],
    queryFn: () =>
      ReleasesService.getProjectReleases({ ownerName, projectName }),
  })
  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      ReleasesService.deleteProjectRelease({
        ownerName,
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
        queryKey: ["projects", ownerName, projectName, "releases"],
      })
    },
  })
  const releases = releasesQuery.data ?? []
  const sortedReleases = [...releases].sort((a, b) => {
    const av = sortValue(a, sort.key)
    const bv = sortValue(b, sort.key)
    let cmp: number
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv))
    }
    return sort.dir === "asc" ? cmp : -cmp
  })

  const SortableTh = ({
    label,
    sortKey,
    isNumeric,
  }: {
    label: string
    sortKey: SortKey
    isNumeric?: boolean
  }) => {
    const active = sort.key === sortKey
    const icon = !active ? FaSort : sort.dir === "asc" ? FaSortUp : FaSortDown
    return (
      <Th
        isNumeric={isNumeric}
        cursor="pointer"
        userSelect="none"
        onClick={() => toggleSort(sortKey)}
        _hover={{ color: "blue.500" }}
      >
        <HStack
          spacing={1}
          display="inline-flex"
          justify={isNumeric ? "flex-end" : "flex-start"}
        >
          <Text as="span">{label}</Text>
          <Icon
            as={icon}
            fontSize="2xs"
            color={active ? "blue.500" : "gray.400"}
          />
        </HStack>
      </Th>
    )
  }

  return (
    <Box>
      <Flex align="center" mb={4}>
        <Heading size="md">Releases</Heading>
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
                <SortableTh label="Name" sortKey="name" />
                <SortableTh label="Path" sortKey="path" />
                <SortableTh label="Version" sortKey="version" />
                <SortableTh label="Date" sortKey="date" />
                <SortableTh label="Visibility" sortKey="visibility" />
                <SortableTh label="Views" sortKey="views" isNumeric />
                <SortableTh label="Comments" sortKey="comments" isNumeric />
                <Th>Link / DOI</Th>
                {userHasWriteAccess && <Th />}
              </Tr>
            </Thead>
            <Tbody>
              {sortedReleases.map((r) => (
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
                    ) : r.url || r.doi || r.publisher ? (
                      <HStack spacing={1}>
                        {r.publisher && (
                          <Badge colorScheme="purple" fontSize="xs">
                            {r.publisher}
                          </Badge>
                        )}
                        {(r.url || r.doi) && (
                          <Link
                            href={r.url ?? `https://doi.org/${r.doi}`}
                            isExternal
                            color="blue.500"
                            fontSize="sm"
                          >
                            {r.doi ?? "Link"}{" "}
                            <Icon as={FiExternalLink} mb="-2px" />
                          </Link>
                        )}
                      </HStack>
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
        ownerName={ownerName}
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

export default ReleasesTable
