import {
  Avatar,
  Badge,
  Box,
  Button,
  Code,
  Collapse,
  Flex,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react"
import { CloseIcon } from "@chakra-ui/icons"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import {
  FaChevronDown,
  FaChevronRight,
  FaCodeBranch,
  FaFile,
  FaTag,
} from "react-icons/fa"
import { FiArrowDown, FiArrowUp } from "react-icons/fi"
import SyntaxHighlighter from "react-syntax-highlighter"
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs"
import { z } from "zod"

import {
  type GitRef,
  ProjectsService,
  ReleasesService,
} from "../../../../../client"
import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import ReleasesTable from "../../../../../components/Releases/ReleasesTable"
import {
  DEFAULT_RELEASE_SORT,
  type ReleaseSort,
} from "../../../../../components/Releases/releaseSort"
import useProject from "../../../../../hooks/useProject"

interface CommitHistory {
  hash: string
  short_hash: string
  message: string
  author: string
  author_email: string
  timestamp: string
  committed_date: number
  parent_hashes: string[]
  summary: string
}

interface ChangedFile {
  path: string
  old_path: string | null
  change_type: string
  insertions: number | null
  deletions: number | null
  patch: string | null
  is_binary?: boolean
  patch_truncated?: boolean
}

interface CommitDetail extends CommitHistory {
  changed_files: ChangedFile[]
  files_truncated?: boolean
}

const TAB_NAMES = ["commits", "releases", "branches", "tags"] as const
const SORT_KEYS = [
  "name",
  "path",
  "version",
  "date",
  "visibility",
  "views",
  "comments",
] as const

const historySearchSchema = z.object({
  ref: z.string().optional(),
  tab: z.enum(TAB_NAMES).optional(),
  // Releases-table sort, persisted so it survives navigation/refresh.
  sort: z.enum(SORT_KEYS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  // How many pages of commits are loaded (page N loads (N+1)*PAGE_SIZE).
  page: z.number().int().min(0).optional(),
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

function FileDiffEntry({ file }: { file: ChangedFile }) {
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
            {file.patch_truncated && (
              <Text px={3} py={2} fontSize="xs" color="orange.400">
                Diff truncated for display.
              </Text>
            )}
          </Box>
        </Collapse>
      )}
      {!hasDiff && file.is_binary && (
        <Text px={3} py={2} fontSize="xs" color="gray.500">
          Binary file not shown.
        </Text>
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
    queryFn: async () =>
      (await ProjectsService.getProjectCommit({
        ownerName,
        projectName,
        commitHash: commit!.hash,
      })) as unknown as CommitDetail,
    enabled: isOpen && Boolean(commit),
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      scrollBehavior="inside"
      isCentered
    >
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
          {commit?.message &&
            commit.message.split("\n").slice(1).join("\n").trim() && (
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
              <Spinner size="xl" color="ui.main" />
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
              {detailQuery.data?.files_truncated && (
                <Text fontSize="xs" color="orange.400">
                  File list truncated; this commit changed more files than are
                  shown.
                </Text>
              )}
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

function BranchRow({
  branch,
  isSelected,
  borderColor,
  bgSelected,
  bgHover,
  onClick,
}: {
  branch: GitRef
  isSelected: boolean
  borderColor: string
  bgSelected: string
  bgHover: string
  onClick: () => void
}) {
  return (
    <Box
      p={3}
      borderWidth={1}
      borderColor={isSelected ? "blue.300" : borderColor}
      borderRadius="md"
      bg={isSelected ? bgSelected : undefined}
      _hover={{ bg: isSelected ? bgSelected : bgHover }}
      cursor="pointer"
      onClick={onClick}
    >
      <Flex align="center" gap={1} wrap="wrap">
        <Icon as={FaCodeBranch} fontSize="xs" color="gray.400" flexShrink={0} />
        <Text fontWeight="bold" fontSize="sm" flex={1} noOfLines={1}>
          {branch.name}
        </Text>
        {branch.is_default && (
          <Badge colorScheme="green" fontSize="xs" flexShrink={0}>
            default
          </Badge>
        )}
        {!branch.is_default && (branch.ahead! > 0 || branch.behind! > 0) && (
          <HStack spacing={1} flexShrink={0}>
            {branch.ahead! > 0 && (
              <Tooltip label={`${branch.ahead} commits ahead of default`}>
                <HStack spacing={0}>
                  <Icon as={FiArrowUp} fontSize="xs" color="green.400" />
                  <Text fontSize="xs" color="green.400">
                    {branch.ahead}
                  </Text>
                </HStack>
              </Tooltip>
            )}
            {branch.behind! > 0 && (
              <Tooltip label={`${branch.behind} commits behind default`}>
                <HStack spacing={0}>
                  <Icon as={FiArrowDown} fontSize="xs" color="orange.400" />
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
        <Text fontSize="xs" color="gray.500" noOfLines={1} mt={1} pl={4}>
          {branch.message}
        </Text>
      )}
    </Box>
  )
}

function History() {
  const { accountName, projectName } = Route.useParams()
  const search = Route.useSearch()
  const selectedRef = search.ref
  const navigate = useNavigate({ from: Route.fullPath })
  const bgHover = useColorModeValue("gray.50", "gray.700")
  const bgSelected = useColorModeValue("blue.50", "blue.900")
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const [selectedCommit, setSelectedCommit] = useState<CommitHistory | null>(
    null,
  )
  const [detailOpen, setDetailOpen] = useState(false)

  // Tab, sort, and pagination are all derived from the URL so they survive
  // refresh and are shareable. Commits default to the URL-clean state.
  const tabIndex = Math.max(0, TAB_NAMES.indexOf(search.tab ?? "commits"))
  const setTabIndex = (i: number) => {
    const name = TAB_NAMES[i]
    navigate({
      search: (prev) => ({
        ...prev,
        tab: name === "commits" ? undefined : name,
      }),
    })
  }
  const sort: ReleaseSort = {
    key: search.sort ?? DEFAULT_RELEASE_SORT.key,
    dir: search.dir ?? DEFAULT_RELEASE_SORT.dir,
  }
  const setSort = (s: ReleaseSort) => {
    const isDefault =
      s.key === DEFAULT_RELEASE_SORT.key && s.dir === DEFAULT_RELEASE_SORT.dir
    navigate({
      search: (prev) => ({
        ...prev,
        sort: isDefault ? undefined : s.key,
        dir: isDefault ? undefined : s.dir,
      }),
    })
  }
  const page = search.page ?? 0
  const setPage = (p: number) =>
    navigate({ search: (prev) => ({ ...prev, page: p > 0 ? p : undefined }) })

  // Load (page+1) pages of commits in a single request so the loaded depth is
  // reconstructable from the URL (reload-safe, unlike client-side accumulation).
  const limit = (page + 1) * PAGE_SIZE
  const commitsQuery = useQuery({
    queryKey: [
      "projects",
      accountName,
      projectName,
      "history",
      selectedRef,
      "limit",
      limit,
    ],
    queryFn: async () =>
      (await ProjectsService.getProjectHistory({
        ownerName: accountName,
        projectName: projectName,
        limit,
        offset: 0,
        ref: selectedRef,
      })) as unknown as CommitHistory[],
  })
  const allCommits = commitsQuery.data ?? []
  const hasMore = allCommits.length === limit
  const isLoadingHistory = commitsQuery.isPending
  const isFetching = commitsQuery.isFetching

  const refsQuery = useQuery({
    queryKey: ["projects", accountName, projectName, "refs", "all"],
    queryFn: () =>
      ProjectsService.searchProjectRefs({
        ownerName: accountName,
        projectName: projectName,
        q: undefined,
      }),
  })

  const branches = ((refsQuery.data ?? []) as GitRef[])
    .filter((r: GitRef) => r.kind === "branch")
    .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))

  const tags = ((refsQuery.data ?? []) as GitRef[]).filter(
    (r: GitRef) => r.kind === "tag",
  )

  // Client-side search across the active tab's loaded items.
  const [query, setQuery] = useState("")
  const ql = query.trim().toLowerCase()
  const displayedCommits = ql
    ? allCommits.filter((c) =>
        `${c.hash ?? ""} ${c.author ?? ""} ${c.message ?? ""}`
          .toLowerCase()
          .includes(ql),
      )
    : allCommits
  const displayedBranches = ql
    ? branches.filter((b) =>
        `${b.name} ${b.message ?? ""}`.toLowerCase().includes(ql),
      )
    : branches
  const displayedTags = ql
    ? tags.filter((t) =>
        `${t.name} ${t.message ?? ""}`.toLowerCase().includes(ql),
      )
    : tags

  const { userHasWriteAccess } = useProject(accountName, projectName)
  // Shares its cache with the Releases tab table (same query key) so the
  // timeline badges and the table stay consistent without a second request.
  const releasesQuery = useQuery({
    queryKey: ["projects", accountName, projectName, "releases", undefined],
    queryFn: () =>
      ReleasesService.getProjectReleases({
        ownerName: accountName,
        projectName,
      }),
  })
  const releases = releasesQuery.data ?? []
  // A release matches a commit when its (possibly abbreviated) git_rev is a
  // prefix of the commit's full hash.
  const releasesForCommit = (hash: string) =>
    releases.filter((r) => r.git_rev && hash.startsWith(r.git_rev))

  const clearRef = () => {
    navigate({
      search: (prev) => ({ ...prev, ref: undefined, page: undefined }),
    })
  }

  // Filter commits by a branch/tag and jump to the Commits tab, resetting how
  // far the commit list is paged.
  const viewRefHistory = (name: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ref: name,
        tab: undefined,
        page: undefined,
      }),
    })
  }

  const openCommit = (commit: CommitHistory) => {
    setSelectedCommit(commit)
    setDetailOpen(true)
  }

  const historyLabel = selectedRef
    ? `History: ${selectedRef}`
    : "Commit history"

  return (
    <Box p={4} maxH="100%" overflowY="auto" w="100%">
      <InputGroup maxW="container.sm" mb={4}>
        <Input
          placeholder="Search commits, releases, branches, and tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          pr={query ? 8 : undefined}
        />
        {query && (
          <InputRightElement>
            <IconButton
              aria-label="Clear search"
              icon={<CloseIcon boxSize="8px" />}
              size="xs"
              variant="ghost"
              onClick={() => setQuery("")}
            />
          </InputRightElement>
        )}
      </InputGroup>
      <Tabs colorScheme="blue" index={tabIndex} onChange={setTabIndex} isLazy>
        <TabList>
          <Tab>Commits</Tab>
          <Tab>Releases</Tab>
          <Tab>Branches</Tab>
          <Tab>Tags</Tab>
        </TabList>
        <TabPanels>
          {/* Commits */}
          <TabPanel px={0}>
            <Flex align="center" gap={2} mb={4}>
              <Heading size="md">{historyLabel}</Heading>
              {selectedRef && (
                <Button size="xs" variant="ghost" onClick={clearRef}>
                  Clear filter
                </Button>
              )}
            </Flex>
            {(isLoadingHistory || isFetching) && allCommits.length === 0 ? (
              <LoadingSpinner height="400px" />
            ) : displayedCommits.length === 0 ? (
              <Text color="gray.500">
                {ql ? "No matching commits" : "No commits found"}
              </Text>
            ) : (
              <>
                <VStack align="stretch" spacing={3}>
                  {displayedCommits.map((commit) => (
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
                        <Avatar name={commit.author} size="sm" />
                        <VStack align="flex-start" spacing={0} flex={1}>
                          <Flex gap={2} align="center" wrap="wrap">
                            <Code fontSize="sm" colorScheme="gray">
                              {commit.short_hash}
                            </Code>
                            <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
                              {commit.summary}
                            </Text>
                            {releasesForCommit(commit.hash).map((r) => (
                              <Tooltip
                                key={`${r.source}-${r.name}`}
                                label={
                                  r.public
                                    ? "Public release"
                                    : "Private release"
                                }
                              >
                                <Badge
                                  colorScheme={r.public ? "green" : "purple"}
                                  fontSize="xs"
                                  flexShrink={0}
                                >
                                  <Icon as={FaTag} mr={1} mb="-1px" />
                                  {r.name}
                                </Badge>
                              </Tooltip>
                            ))}
                          </Flex>
                          <Flex gap={2} fontSize="xs" color="gray.500" mt={1}>
                            <Text>{commit.author}</Text>
                            <Text>•</Text>
                            <Text>
                              {new Date(commit.timestamp).toLocaleDateString()}{" "}
                              at{" "}
                              {new Date(commit.timestamp).toLocaleTimeString()}
                            </Text>
                          </Flex>
                        </VStack>
                      </Flex>

                      {commit.message
                        .split("\n")
                        .slice(1)
                        .join("\n")
                        .trim() && (
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
                            {commit.message
                              .split("\n")
                              .slice(1)
                              .join("\n")
                              .trim()}
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
                      onClick={() => setPage(page + 1)}
                    >
                      Load more
                    </Button>
                  </Flex>
                )}
              </>
            )}
          </TabPanel>

          {/* Releases */}
          <TabPanel px={0}>
            <ReleasesTable
              ownerName={accountName}
              projectName={projectName}
              userHasWriteAccess={userHasWriteAccess}
              sort={sort}
              onSortChange={setSort}
              filter={query}
            />
          </TabPanel>

          {/* Branches */}
          <TabPanel px={0}>
            <Heading size="md" mb={3}>
              Branches
            </Heading>
            {refsQuery.isPending ? (
              <Flex justify="center" py={2}>
                <Spinner size="sm" color="ui.main" />
              </Flex>
            ) : displayedBranches.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                {ql ? "No matching branches" : "No branches found"}
              </Text>
            ) : (
              <VStack align="stretch" spacing={2} maxW="container.sm">
                {displayedBranches.map((branch) => (
                  <BranchRow
                    key={branch.name}
                    branch={branch}
                    isSelected={selectedRef === branch.name}
                    borderColor={borderColor}
                    bgSelected={bgSelected}
                    bgHover={bgHover}
                    onClick={() => viewRefHistory(branch.name)}
                  />
                ))}
              </VStack>
            )}
          </TabPanel>

          {/* Tags */}
          <TabPanel px={0}>
            <Heading size="md" mb={3}>
              Tags
            </Heading>
            {refsQuery.isPending ? (
              <Flex justify="center" py={2}>
                <Spinner size="sm" color="ui.main" />
              </Flex>
            ) : displayedTags.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                {ql ? "No matching tags" : "No tags found"}
              </Text>
            ) : (
              <VStack align="stretch" spacing={2} maxW="container.sm">
                {displayedTags.map((tag) => {
                  const isSelected = selectedRef === tag.name
                  return (
                    <Box
                      key={tag.name}
                      p={3}
                      borderWidth={1}
                      borderColor={isSelected ? "blue.300" : borderColor}
                      borderRadius="md"
                      bg={isSelected ? bgSelected : undefined}
                      _hover={{ bg: isSelected ? bgSelected : bgHover }}
                      cursor="pointer"
                      onClick={() => viewRefHistory(tag.name)}
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
                        <Text
                          fontSize="xs"
                          color="gray.500"
                          noOfLines={1}
                          mt={1}
                        >
                          {tag.message}
                        </Text>
                      )}
                    </Box>
                  )
                })}
              </VStack>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      <CommitDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        ownerName={accountName}
        projectName={projectName}
        commit={selectedCommit}
      />
    </Box>
  )
}
