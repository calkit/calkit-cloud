import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Avatar,
  VStack,
  Badge,
  Code,
  useColorModeValue,
  Divider,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  HStack,
  Icon,
  Collapse,
  Tooltip,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { z } from "zod"
import {
  FaFile,
  FaChevronDown,
  FaChevronRight,
  FaCodeBranch,
} from "react-icons/fa"
import { FiArrowUp, FiArrowDown } from "react-icons/fi"
import SyntaxHighlighter from "react-syntax-highlighter"
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs"

import PageMenu from "../../../../../components/Common/PageMenu"
import {
  getProjectHistory,
  getProjectCommit,
  searchProjectRefs,
  type CommitHistory,
} from "../../../../../lib/projectRefApi"

const historySearchSchema = z.object({
  ref: z.string().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/history",
)({
  component: History,
  validateSearch: (search) => historySearchSchema.parse(search),
})

const PAGE_SIZE = 30

const CHANGE_COLORS: Record<string, string> = {
  A: "green",
  D: "red",
  M: "blue",
  R: "purple",
  C: "orange",
}

const CHANGE_LABELS: Record<string, string> = {
  A: "Added",
  D: "Deleted",
  M: "Modified",
  R: "Renamed",
  C: "Copied",
}

function FileDiffEntry({
  file,
}: {
  file: {
    path: string
    old_path: string | null
    change_type: string
    insertions: number | null
    deletions: number | null
    patch: string | null
  }
}) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const hoverBg = useColorModeValue("gray.50", "gray.700")
  const hasDiff = Boolean(file.patch)

  return (
    <Box
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="md"
      overflow="hidden"
    >
      <HStack
        px={3}
        py={2}
        spacing={2}
        cursor={hasDiff ? "pointer" : "default"}
        onClick={() => hasDiff && setExpanded((v) => !v)}
        _hover={hasDiff ? { bg: hoverBg } : {}}
      >
        {hasDiff && (
          <Icon
            as={expanded ? FaChevronDown : FaChevronRight}
            fontSize="xs"
            color="gray.400"
          />
        )}
        <Badge
          colorScheme={CHANGE_COLORS[file.change_type] ?? "gray"}
          fontSize="xs"
          minW="60px"
          textAlign="center"
          flexShrink={0}
        >
          {CHANGE_LABELS[file.change_type] ?? file.change_type}
        </Badge>
        <Icon as={FaFile} color="gray.400" fontSize="xs" flexShrink={0} />
        <Code fontSize="xs" flex={1} isTruncated>
          {file.path}
        </Code>
        {file.old_path && (
          <Text fontSize="xs" color="gray.400" flexShrink={0}>
            from {file.old_path}
          </Text>
        )}
        {file.insertions != null && (
          <HStack spacing={1} fontSize="xs" flexShrink={0}>
            <Text color="green.500" fontWeight="bold">
              +{file.insertions}
            </Text>
            <Text color="red.500" fontWeight="bold">
              -{file.deletions}
            </Text>
          </HStack>
        )}
      </HStack>
      {hasDiff && (
        <Collapse in={expanded} animateOpacity>
          <Box maxH="400px" overflowY="auto" fontSize="xs">
            <SyntaxHighlighter
              language="diff"
              style={atomOneDark}
              customStyle={{ margin: 0, borderRadius: 0, fontSize: "12px" }}
              showLineNumbers={false}
            >
              {file.patch!}
            </SyntaxHighlighter>
          </Box>
        </Collapse>
      )}
    </Box>
  )
}

function CommitDetailModal({
  isOpen,
  onClose,
  ownerName,
  projectName,
  commit,
}: {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  commit: CommitHistory | null
}) {
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const detailQuery = useQuery({
    queryKey: ["projects", ownerName, projectName, "commit", commit?.hash],
    queryFn: () =>
      getProjectCommit({
        ownerName,
        projectName,
        commitHash: commit!.hash,
      }),
    enabled: isOpen && Boolean(commit),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader pr={12}>
          {commit && (
            <Flex align="center" gap={2}>
              <Code fontSize="sm">{commit.short_hash}</Code>
              <Text fontSize="md" fontWeight="semibold" noOfLines={2}>
                {commit.summary}
              </Text>
            </Flex>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {commit && (
            <Flex gap={2} fontSize="sm" color="gray.500" mb={4}>
              <Text>{commit.author}</Text>
              <Text>•</Text>
              <Text>
                {new Date(commit.timestamp).toLocaleDateString()} at{" "}
                {new Date(commit.timestamp).toLocaleTimeString()}
              </Text>
            </Flex>
          )}
          {commit?.message && commit.message.split("\n").length > 1 && (
            <Box
              mb={4}
              p={3}
              borderRadius="md"
              borderWidth={1}
              borderColor={borderColor}
            >
              <Text fontSize="sm" whiteSpace="pre-wrap" color="gray.600">
                {commit.message.split("\n").slice(1).join("\n").trim()}
              </Text>
            </Box>
          )}
          <Heading size="xs" mb={2}>
            Changed files
          </Heading>
          {detailQuery.isPending ? (
            <Flex justify="center" py={4}>
              <Spinner size="md" />
            </Flex>
          ) : detailQuery.data?.changed_files?.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No changed files
            </Text>
          ) : (
            <VStack align="stretch" spacing={2}>
              {detailQuery.data?.changed_files?.map((f, i) => (
                <FileDiffEntry key={i} file={f} />
              ))}
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

function History() {
  const { accountName, projectName } = Route.useParams()
  const { ref: selectedRef } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const bgHover = useColorModeValue("gray.50", "gray.700")
  const bgSelected = useColorModeValue("blue.50", "blue.900")
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const [page, setPage] = useState(0)
  const [allCommits, setAllCommits] = useState<CommitHistory[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [selectedCommit, setSelectedCommit] = useState<CommitHistory | null>(
    null,
  )
  const [detailOpen, setDetailOpen] = useState(false)

  // Reset pagination when ref changes
  useEffect(() => {
    setPage(0)
    setAllCommits([])
    setHasMore(true)
  }, [selectedRef])

  const { isPending: isLoadingHistory, isFetching } = useQuery({
    queryKey: [
      "projects",
      accountName,
      projectName,
      "history",
      selectedRef,
      "page",
      page,
    ],
    queryFn: async () => {
      const results = await getProjectHistory({
        ownerName: accountName,
        projectName: projectName,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ref: selectedRef,
      })
      setAllCommits((prev) => {
        if (page === 0) return results
        const existing = new Set(prev.map((c) => c.hash))
        return [...prev, ...results.filter((c) => !existing.has(c.hash))]
      })
      setHasMore(results.length === PAGE_SIZE)
      return results
    },
  })

  const refsQuery = useQuery({
    queryKey: ["projects", accountName, projectName, "refs", "all"],
    queryFn: () =>
      searchProjectRefs({
        ownerName: accountName,
        projectName: projectName,
        q: undefined,
      }),
  })

  const branches = (refsQuery.data ?? [])
    .filter((r) => r.type === "branch")
    .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))

  const tags = (refsQuery.data ?? []).filter((r) => r.type === "tag")

  const selectRef = (name: string) => {
    navigate({ search: (prev) => ({ ...prev, ref: name }) })
  }

  const clearRef = () => {
    navigate({ search: (prev) => ({ ...prev, ref: undefined }) })
  }

  const openCommit = (commit: CommitHistory) => {
    setSelectedCommit(commit)
    setDetailOpen(true)
  }

  const historyLabel = selectedRef
    ? `History: ${selectedRef}`
    : "Commit history"

  return (
    <Flex height="100%">
      <PageMenu>
        <Box mb={4}>
          <Heading size="md" mb={2}>
            Branches
          </Heading>
          {refsQuery.isPending ? (
            <Flex justify="center" py={2}>
              <Spinner size="sm" color="ui.main" />
            </Flex>
          ) : branches.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No branches found
            </Text>
          ) : (
            <VStack align="stretch" spacing={1}>
              {branches.map((branch) => {
                const isSelected = selectedRef === branch.name
                return (
                  <Box
                    key={branch.name}
                    p={2}
                    borderRadius="md"
                    bg={isSelected ? bgSelected : undefined}
                    borderWidth={isSelected ? 1 : 0}
                    borderColor="blue.300"
                    _hover={{ bg: isSelected ? bgSelected : bgHover }}
                    cursor="pointer"
                    onClick={() =>
                      isSelected ? clearRef() : selectRef(branch.name)
                    }
                  >
                    <Flex align="center" gap={1} wrap="wrap">
                      <Icon
                        as={FaCodeBranch}
                        fontSize="xs"
                        color="gray.400"
                        flexShrink={0}
                      />
                      <Text
                        fontWeight="bold"
                        fontSize="sm"
                        flex={1}
                        noOfLines={1}
                      >
                        {branch.name}
                      </Text>
                      {branch.is_default && (
                        <Badge colorScheme="green" fontSize="xs" flexShrink={0}>
                          default
                        </Badge>
                      )}
                      {!branch.is_default &&
                        (branch.ahead! > 0 || branch.behind! > 0) && (
                          <HStack spacing={1} flexShrink={0}>
                            {branch.ahead! > 0 && (
                              <Tooltip
                                label={`${branch.ahead} commits ahead of default`}
                              >
                                <HStack spacing={0}>
                                  <Icon
                                    as={FiArrowUp}
                                    fontSize="xs"
                                    color="green.400"
                                  />
                                  <Text fontSize="xs" color="green.400">
                                    {branch.ahead}
                                  </Text>
                                </HStack>
                              </Tooltip>
                            )}
                            {branch.behind! > 0 && (
                              <Tooltip
                                label={`${branch.behind} commits behind default`}
                              >
                                <HStack spacing={0}>
                                  <Icon
                                    as={FiArrowDown}
                                    fontSize="xs"
                                    color="orange.400"
                                  />
                                  <Text fontSize="xs" color="orange.400">
                                    {branch.behind}
                                  </Text>
                                </HStack>
                              </Tooltip>
                            )}
                          </HStack>
                        )}
                    </Flex>
                    {branch.message && (
                      <Text
                        fontSize="xs"
                        color="gray.500"
                        noOfLines={1}
                        mt={0.5}
                        pl={4}
                      >
                        {branch.message}
                      </Text>
                    )}
                  </Box>
                )
              })}
            </VStack>
          )}
        </Box>

        <Divider my={4} />

        <Box mb={4}>
          <Heading size="md" mb={2}>
            Tags
          </Heading>
          {refsQuery.isPending ? (
            <Flex justify="center" py={2}>
              <Spinner size="sm" color="ui.main" />
            </Flex>
          ) : tags.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No tags found
            </Text>
          ) : (
            <VStack align="stretch" spacing={1}>
              {tags.map((tag) => {
                const isSelected = selectedRef === tag.name
                return (
                  <Box
                    key={tag.name}
                    p={2}
                    borderRadius="md"
                    bg={isSelected ? bgSelected : undefined}
                    borderWidth={isSelected ? 1 : 0}
                    borderColor="blue.300"
                    _hover={{ bg: isSelected ? bgSelected : bgHover }}
                    cursor="pointer"
                    onClick={() =>
                      isSelected ? clearRef() : selectRef(tag.name)
                    }
                  >
                    <Flex align="center" gap={2}>
                      <Badge colorScheme="purple" fontSize="xs">
                        Tag
                      </Badge>
                      <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
                        {tag.name}
                      </Text>
                    </Flex>
                    {tag.message && (
                      <Text fontSize="xs" color="gray.500" noOfLines={1} mt={1}>
                        {tag.message}
                      </Text>
                    )}
                  </Box>
                )
              })}
            </VStack>
          )}
        </Box>
      </PageMenu>

      <Box flex={1} p={4} maxH="100%" overflowY="auto">
        <Flex align="center" gap={2} mb={4}>
          <Heading size="md">{historyLabel}</Heading>
          {selectedRef && (
            <Button size="xs" variant="ghost" onClick={clearRef}>
              Clear
            </Button>
          )}
        </Flex>

        {isLoadingHistory && allCommits.length === 0 ? (
          <Flex justify="center" align="center" height="400px">
            <Spinner size="lg" color="ui.main" />
          </Flex>
        ) : allCommits.length === 0 ? (
          <Text color="gray.500">No commits found</Text>
        ) : (
          <>
            <VStack align="stretch" spacing={3}>
              {allCommits.map((commit) => (
                <Box
                  key={commit.hash}
                  p={3}
                  borderWidth={1}
                  borderColor={borderColor}
                  borderRadius="md"
                  _hover={{ bg: bgHover, cursor: "pointer" }}
                  onClick={() => openCommit(commit)}
                >
                  <Flex align="flex-start" gap={3} mb={2}>
                    <Avatar
                      name={commit.author}
                      size="sm"
                      src={`https://www.gravatar.com/avatar/${commit.author_email}?s=32&d=identicon`}
                    />
                    <VStack align="flex-start" spacing={0} flex={1}>
                      <Flex gap={2} align="center">
                        <Code fontSize="sm" colorScheme="gray">
                          {commit.short_hash}
                        </Code>
                        <Text
                          fontWeight="bold"
                          fontSize="sm"
                          flex={1}
                          noOfLines={1}
                        >
                          {commit.summary}
                        </Text>
                      </Flex>
                      <Flex gap={2} fontSize="xs" color="gray.500" mt={1}>
                        <Text>{commit.author}</Text>
                        <Text>•</Text>
                        <Text>
                          {new Date(commit.timestamp).toLocaleDateString()} at{" "}
                          {new Date(commit.timestamp).toLocaleTimeString()}
                        </Text>
                      </Flex>
                    </VStack>
                  </Flex>

                  {commit.message.split("\n").length > 1 && (
                    <Box
                      pl={12}
                      pt={1}
                      borderLeftWidth={2}
                      borderLeftColor={borderColor}
                    >
                      <Text
                        fontSize="xs"
                        color="gray.600"
                        whiteSpace="pre-wrap"
                        noOfLines={3}
                      >
                        {commit.message.split("\n").slice(1).join("\n")}
                      </Text>
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>

            {hasMore && (
              <Flex justify="center" mt={4}>
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Load more
                </Button>
              </Flex>
            )}
          </>
        )}
      </Box>

      <CommitDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        ownerName={accountName}
        projectName={projectName}
        commit={selectedCommit}
      />
    </Flex>
  )
}
