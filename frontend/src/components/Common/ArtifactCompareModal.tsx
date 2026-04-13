/**
 * Modal for viewing an artifact with version comparison support.
 *
 * Shows the artifact content alongside a version history panel. Users can
 * select two commits to compare side-by-side.
 */
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Flex,
  Box,
  Text,
  Heading,
  Spinner,
  Badge,
  Code,
  Button,
  VStack,
  Divider,
  useColorModeValue,
  IconButton,
  Tooltip,
  Link,
  Textarea,
  Avatar,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Icon,
  Checkbox,
  Switch,
} from "@chakra-ui/react"
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaCodeBranch,
  FaGithub,
  FaLink,
  FaUndo,
  FaReply,
} from "react-icons/fa"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect, lazy, Suspense } from "react"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"

import FigureView from "../Figures/FigureView"
import PdfCanvas from "./PdfCanvas"
import FileContent from "../Files/FileContent"
import {
  type Figure,
  type GitRef,
  type Publication,
  type Notebook,
  type ContentsItem,
  ProjectsService,
} from "../../client"
import useAuth from "../../hooks/useAuth"
const IpynbRenderer = lazy(() =>
  import("react-ipynb-renderer").then(async (m) => {
    await import("react-ipynb-renderer/dist/styles/monokai.css")
    return { default: m.IpynbRenderer }
  }),
)

/** "file" covers auto-detected types not explicitly declared in calkit.yaml. */
export type ArtifactKind = "figure" | "publication" | "notebook" | "file"

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

interface ArtifactCompareModalProps {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  path: string
  kind: ArtifactKind
  initialRef?: string
  initialRef2?: string
  initialArtifact?: Figure | Publication | Notebook | ContentsItem
  onRefsChange?: (ref1: string | undefined, ref2: string | undefined) => void
  onPrev?: () => void
  onNext?: () => void
}

/** Render the artifact content for a given kind/data. */
function ArtifactContent({
  kind,
  path,
  data,
}: {
  kind: ArtifactKind
  path: string
  data: Figure | Publication | Notebook | ContentsItem | undefined
}) {
  if (!data) return <Text color="gray.500">Not available at this version.</Text>

  if (kind === "file") {
    const item = data as ContentsItem
    if (!item.content && !item.url)
      return <Text color="gray.500">No content found for this version.</Text>
    return <FileContent item={item} />
  }

  if (kind === "figure") {
    const fig = data as Figure
    if (!fig.content && !fig.url) {
      return <Text color="gray.500">No content found for this version.</Text>
    }
    if (path.endsWith(".pdf")) {
      const src = fig.content
        ? `data:application/pdf;base64,${fig.content}`
        : String(fig.url)
      return <PdfCanvas src={src} height="100%" />
    }
    return (
      <Box height="100%" width="100%">
        <FigureView figure={fig} />
      </Box>
    )
  }

  if (kind === "publication") {
    const pub = data as Publication
    if (!pub.url)
      return <Text color="gray.500">No URL for this publication.</Text>
    if (path.endsWith(".pdf") || pub.url?.includes(".pdf")) {
      return (
        <Box height="75vh" width="100%">
          <embed
            height="100%"
            width="100%"
            type="application/pdf"
            src={pub.url}
          />
        </Box>
      )
    }
    return (
      <Link href={pub.url} isExternal color="blue.500">
        Open publication
      </Link>
    )
  }

  if (kind === "notebook") {
    const nb = data as Notebook
    if (!nb.url && !nb.content)
      return <Text color="gray.500">No content for this version.</Text>
    if (nb.content && nb.output_format === "notebook") {
      try {
        const json = JSON.parse(atob(nb.content))
        return (
          <Box height="75vh" overflowY="auto">
            <Suspense fallback={<Spinner />}>
              <IpynbRenderer ipynb={json} syntaxTheme="atomDark" />
            </Suspense>
          </Box>
        )
      } catch {
        // fall through
      }
    }
    if (nb.content && nb.output_format === "html") {
      return (
        <Box height="75vh" width="100%">
          <embed
            height="100%"
            width="100%"
            type="text/html"
            src={`data:text/html;base64,${nb.content}`}
          />
        </Box>
      )
    }
    if (nb.url) {
      return (
        <Box height="75vh" width="100%">
          <iframe
            height="100%"
            width="100%"
            title="notebook"
            src={nb.url}
            style={{ border: "none" }}
          />
        </Box>
      )
    }
    return <Text color="gray.500">Cannot render this notebook.</Text>
  }

  return null
}

function useArtifactAtRef(
  ownerName: string,
  projectName: string,
  path: string,
  kind: ArtifactKind,
  ref: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      "projects",
      ownerName,
      projectName,
      kind,
      path,
      ref,
      "compare-modal",
    ],
    queryFn: async () => {
      if (kind === "file") {
        return ProjectsService.getProjectContents({
          ownerName,
          projectName,
          path,
          ref,
        })
      }
      if (kind === "figure") {
        const figs = await ProjectsService.getProjectFigures({
          ownerName,
          projectName,
          ref,
        })
        // Fall back to contents API if not declared in calkit.yaml
        const found = figs.find((f) => f.path === path)
        if (found) return found
        return ProjectsService.getProjectContents({
          ownerName,
          projectName,
          path,
          ref,
        })
      }
      if (kind === "publication") {
        const pubs = await ProjectsService.getProjectPublications({
          ownerName,
          projectName,
          ref,
        })
        const found = pubs.find((p) => p.path === path)
        if (found) return found
        return ProjectsService.getProjectContents({
          ownerName,
          projectName,
          path,
          ref,
        })
      }
      if (kind === "notebook") {
        const nbs = await ProjectsService.getProjectNotebooks({
          ownerName,
          projectName,
          ref,
        })
        const found = nbs.find((n) => n.path === path)
        if (found) return found
        return ProjectsService.getProjectContents({
          ownerName,
          projectName,
          path,
          ref,
        })
      }
    },
    enabled,
    retry: false,
  })
}

function FigureComments({
  ownerName,
  projectName,
  path,
  gitRef,
}: {
  ownerName: string
  projectName: string
  path: string
  gitRef?: string | undefined
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const [draft, setDraft] = useState("")
  const [createIssue, setCreateIssue] = useState(true)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")

  const replyMutation = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      ProjectsService.postProjectCommentReply({
        ownerName,
        projectName,
        commentId,
        requestBody: { body },
      }),
    onSuccess: () => {
      setReplyingToId(null)
      setReplyDraft("")
      queryClient.invalidateQueries({
        queryKey: [
          "projects",
          ownerName,
          projectName,
          "comments",
          "figure",
          path,
        ],
      })
    },
  })

  const commentsQuery = useQuery({
    queryKey: ["projects", ownerName, projectName, "comments", "figure", path],
    queryFn: () =>
      ProjectsService.getProjectComments({
        ownerName,
        projectName,
        artifactType: "figure",
        artifactPath: path,
      }),
  })

  const [showResolved, setShowResolved] = useState(false)

  const postMutation = useMutation({
    mutationFn: () =>
      ProjectsService.postProjectComment({
        ownerName,
        projectName,
        requestBody: {
          artifact_path: path,
          artifact_type: "figure",
          comment: draft,
          create_github_issue: createIssue,
          git_ref: gitRef ?? null,
        },
      }),
    onSuccess: () => {
      setDraft("")
      queryClient.invalidateQueries({
        queryKey: [
          "projects",
          ownerName,
          projectName,
          "comments",
          "figure",
          path,
        ],
      })
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "figures"],
      })
    },
  })

  const resolveMutation = useMutation({
    mutationFn: ({
      commentId,
      resolved,
    }: {
      commentId: string
      resolved: boolean
    }) =>
      ProjectsService.patchProjectComment({
        ownerName,
        projectName,
        commentId,
        requestBody: { resolved },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "projects",
          ownerName,
          projectName,
          "comments",
          "figure",
          path,
        ],
      })
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "figures"],
      })
    },
  })

  const allComments = commentsQuery.data ?? []
  const topLevel = allComments.filter((c) => !(c as any).parent_id)
  const repliesFor = (parentId: string) =>
    allComments.filter((c) => (c as any).parent_id === parentId)
  const displayedTopLevel = showResolved
    ? topLevel
    : topLevel.filter((c) => !c.resolved)

  // Renders a single comment card without reply UI.
  const renderCommentCard = (c: (typeof allComments)[0], isReply = false) => {
    const isResolved = !!c.resolved
    return (
      <Flex key={c.id} gap={2}>
        <Avatar
          name={c.user_github_username}
          size="xs"
          mt={0.5}
          flexShrink={0}
        />
        <Box
          flex={1}
          borderWidth={1}
          borderColor={isResolved ? "green.200" : borderColor}
          borderRadius="md"
          p={2}
          opacity={isResolved ? 0.7 : 1}
        >
          <Flex align="center" gap={1} mb={1} wrap="wrap">
            <Text fontSize="xs" fontWeight="bold" mr={1}>
              {c.user_github_username}
            </Text>
            <Text fontSize="xs" color="gray.500" mr="auto">
              {c.created ? new Date(c.created).toLocaleDateString() : ""}
            </Text>
            {c.external_url && (
              <Link href={c.external_url} isExternal color="gray.500">
                <Flex align="center" gap={0.5}>
                  <Icon as={FaGithub} boxSize={3} />
                  <ExternalLinkIcon boxSize={2.5} />
                </Flex>
              </Link>
            )}
            {user &&
              !isReply &&
              (resolveMutation.isPending &&
              resolveMutation.variables?.commentId === c.id ? (
                <Spinner size="xs" color="ui.main" />
              ) : (
                <IconButton
                  aria-label={isResolved ? "Unresolve" : "Resolve"}
                  icon={
                    isResolved ? <Icon as={FaUndo} /> : <Icon as={FaCheck} />
                  }
                  size="xs"
                  variant="ghost"
                  colorScheme={isResolved ? "gray" : "green"}
                  onClick={() =>
                    c.id &&
                    resolveMutation.mutate({
                      commentId: c.id,
                      resolved: !isResolved,
                    })
                  }
                />
              ))}
          </Flex>
          <Text fontSize="sm" whiteSpace="pre-wrap">
            {c.comment}
          </Text>
        </Box>
      </Flex>
    )
  }

  // Renders a top-level comment with its flat reply thread.
  // Replies are one level deep; the reply input targets the top-level comment.
  const renderComment = (c: (typeof allComments)[0]) => {
    const replies = c.id ? repliesFor(c.id) : []
    const threadId = c.id ?? null
    return (
      <Box key={c.id}>
        {renderCommentCard(c, false)}
        {replies.length > 0 && (
          <VStack align="stretch" spacing={1} mt={1} ml={6}>
            {replies.map((r) => renderCommentCard(r, true))}
          </VStack>
        )}
        {user && (
          <Box mt={1} ml={6}>
            {replyingToId !== threadId ? (
              <Button
                size="xs"
                variant="ghost"
                leftIcon={<Icon as={FaReply} />}
                onClick={() => {
                  setReplyingToId(threadId)
                  setReplyDraft("")
                }}
              >
                Reply
              </Button>
            ) : (
              <Box>
                <Textarea
                  size="xs"
                  placeholder="Add a reply…"
                  value={replyDraft}
                  autoFocus
                  onChange={(e) => setReplyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.metaKey || e.ctrlKey) &&
                      replyDraft.trim() &&
                      threadId
                    ) {
                      e.preventDefault()
                      replyMutation.mutate({
                        commentId: threadId,
                        body: replyDraft.trim(),
                      })
                    }
                  }}
                  rows={2}
                  mb={1}
                />
                <Flex align="center" gap={3} mb={2}>
                  <Button
                    size="xs"
                    variant="primary"
                    isDisabled={!replyDraft.trim()}
                    isLoading={
                      replyMutation.isPending &&
                      replyMutation.variables?.commentId === threadId
                    }
                    onClick={() =>
                      threadId &&
                      replyMutation.mutate({
                        commentId: threadId,
                        body: replyDraft.trim(),
                      })
                    }
                  >
                    Post
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setReplyingToId(null)}
                  >
                    Cancel
                  </Button>
                </Flex>
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box>
      <Flex align="center" justify="space-between" mb={3}>
        <Heading size="xs">
          Comments ({topLevel.filter((c) => !c.resolved).length} open)
        </Heading>
        <Flex align="center" gap={1}>
          <Text fontSize="xs" color="gray.500">
            Resolved
          </Text>
          <Switch
            size="sm"
            isChecked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
        </Flex>
      </Flex>
      {commentsQuery.isPending ? (
        <Flex justify="center" py={2}>
          <Spinner size="sm" color="ui.main" />
        </Flex>
      ) : displayedTopLevel.length === 0 ? (
        <Text fontSize="xs" color="gray.500" mb={3}>
          {allComments.length === 0 ? "No comments yet." : "No open comments."}
        </Text>
      ) : (
        <VStack align="stretch" spacing={3} mb={4}>
          {displayedTopLevel.map((c) => renderComment(c))}
        </VStack>
      )}
      {user && (
        <Box>
          <Textarea
            placeholder="Add a comment…"
            size="sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                (e.metaKey || e.ctrlKey) &&
                draft.trim()
              ) {
                e.preventDefault()
                postMutation.mutate()
              }
            }}
            rows={3}
            mb={2}
          />
          <Flex align="center" gap={3} mb={2}>
            <Checkbox
              size="sm"
              isChecked={createIssue}
              onChange={(e) => setCreateIssue(e.target.checked)}
            >
              Create GitHub issue
            </Checkbox>
            <Button
              size="xs"
              variant="primary"
              isDisabled={!draft.trim()}
              isLoading={postMutation.isPending}
              onClick={() => postMutation.mutate()}
            >
              Post
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  )
}

export function ArtifactCompareModal({
  isOpen,
  onClose,
  ownerName,
  projectName,
  path,
  kind,
  initialRef,
  initialRef2,
  initialArtifact,
  onRefsChange,
  onPrev,
  onNext,
}: ArtifactCompareModalProps) {
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const hoverBg = useColorModeValue("gray.50", "gray.700")
  const selectedBg = useColorModeValue("blue.50", "blue.900")

  const [ref1, setRef1] = useState<string | undefined>(initialRef)
  const [ref2, setRef2] = useState<string | undefined>(initialRef2)
  const [branchesEnabled, setBranchesEnabled] = useState(false)

  useEffect(() => {
    setRef1(initialRef)
    setRef2(initialRef2)
  }, [initialRef, initialRef2])

  useEffect(() => {
    onRefsChange?.(ref1, ref2)
  }, [ref1, ref2])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev?.()
      else if (e.key === "ArrowRight") onNext?.()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onPrev, onNext])

  const artifactStorage = (initialArtifact as { storage?: string } | undefined)
    ?.storage as "git" | "dvc" | "dvc-zip" | undefined
  const historyQuery = useQuery({
    queryKey: [
      "projects",
      ownerName,
      projectName,
      "file-history",
      path,
      artifactStorage,
    ],
    queryFn: async () =>
      (await ProjectsService.getProjectFileHistory({
        ownerName,
        projectName,
        path,
        limit: 50,
        storage: artifactStorage ?? null,
      })) as unknown as CommitHistory[],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  })

  const refsQuery = useQuery({
    queryKey: ["projects", ownerName, projectName, "refs"],
    queryFn: () =>
      ProjectsService.searchProjectRefs({ ownerName, projectName }),
    enabled: isOpen && branchesEnabled,
    staleTime: 5 * 60 * 1000,
  })
  const branches = (refsQuery.data ?? []).filter(
    (r: GitRef) => r.kind === "branch",
  )

  // For figure/publication/notebook, fetching without a ref loads ALL items just
  // to find one--skip that when we already have initialArtifact. For "file", the
  // fetch is a direct single-file call so it's cheap and always useful.
  const artifact1Enabled = kind === "file" ? isOpen : isOpen && Boolean(ref1)
  const artifact1Query = useArtifactAtRef(
    ownerName,
    projectName,
    path,
    kind,
    ref1,
    artifact1Enabled,
  )
  const artifact2Query = useArtifactAtRef(
    ownerName,
    projectName,
    path,
    kind,
    ref2,
    isOpen && Boolean(ref2),
  )

  // For figure/publication/notebook: when no ref is selected, use the pre-loaded
  // artifact from the parent so we don't fetch all items. For file, artifact1Query
  // always runs so use its data directly.
  const displayData1 =
    kind === "file" || ref1 ? artifact1Query.data : initialArtifact
  const isPending1 = kind === "file" || ref1 ? artifact1Query.isPending : false

  const isComparing = Boolean(ref2)

  const getShareUrl = () => {
    const url = new URL(window.location.href)
    if (ref1) url.searchParams.set("base_ref", ref1)
    else url.searchParams.delete("base_ref")
    if (ref2) url.searchParams.set("compare_ref", ref2)
    else url.searchParams.delete("compare_ref")
    return url.toString()
  }

  const copyShareUrl = () => {
    navigator.clipboard.writeText(getShareUrl())
  }

  const handleCommitClick = (commit: CommitHistory) => {
    // First click sets ref1, second click sets ref2, third resets
    if (!ref1 || ref1 === commit.short_hash) {
      setRef1(commit.short_hash)
      setRef2(undefined)
    } else if (!ref2) {
      setRef2(commit.short_hash)
    } else {
      setRef1(commit.short_hash)
      setRef2(undefined)
    }
  }

  const clearComparison = () => {
    setRef1(undefined)
    setRef2(undefined)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="6xl"
      scrollBehavior="inside"
      isCentered
    >
      <ModalOverlay />
      <ModalContent maxW="95vw" maxH="95vh">
        <ModalHeader pr={12}>
          <Flex align="center" gap={2}>
            <Text noOfLines={1} flex={1}>
              {path}
            </Text>
            {isComparing && (
              <Tooltip label="Copy shareable link">
                <IconButton
                  aria-label="Copy share link"
                  icon={<FaLink />}
                  size="sm"
                  variant="ghost"
                  onClick={copyShareUrl}
                />
              </Tooltip>
            )}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={4}>
          <Flex gap={4} height="80vh">
            {/* Version history sidebar */}
            <Box
              w="200px"
              flexShrink={0}
              borderRightWidth={1}
              borderColor={borderColor}
              pr={3}
              overflowY="auto"
            >
              {(ref1 || ref2) && (
                <Button
                  size="xs"
                  variant="ghost"
                  mb={2}
                  onClick={clearComparison}
                >
                  Clear selection
                </Button>
              )}
              {ref1 && !ref2 && (
                <Text fontSize="xs" color="gray.500" mb={2}>
                  Click another version to compare
                </Text>
              )}
              <Tabs
                size="sm"
                variant="enclosed"
                onChange={(i) => {
                  if (i === 1) setBranchesEnabled(true)
                }}
              >
                <TabList>
                  <Tab fontSize="xs">Commits</Tab>
                  <Tab fontSize="xs">Branches</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel px={0} pb={0}>
                    {historyQuery.isPending ? (
                      <Flex justify="center" py={2}>
                        <Spinner size="sm" color="ui.main" />
                      </Flex>
                    ) : (historyQuery.data?.length ?? 0) === 0 ? (
                      <Text fontSize="xs" color="gray.500">
                        No version history found.
                      </Text>
                    ) : (
                      <VStack align="stretch" spacing={1}>
                        {historyQuery.data?.map((commit) => {
                          const isRef1 = commit.short_hash === ref1
                          const isRef2 = commit.short_hash === ref2
                          return (
                            <Box
                              key={commit.hash}
                              p={2}
                              borderRadius="md"
                              cursor="pointer"
                              bg={isRef1 || isRef2 ? selectedBg : undefined}
                              _hover={{
                                bg: isRef1 || isRef2 ? selectedBg : hoverBg,
                              }}
                              onClick={() => handleCommitClick(commit)}
                              borderWidth={isRef1 || isRef2 ? 1 : 0}
                              borderColor="blue.300"
                            >
                              <Flex align="center" gap={1} mb={0.5}>
                                <Code fontSize="xs">{commit.short_hash}</Code>
                                {isRef1 && (
                                  <Badge colorScheme="blue" fontSize="xs">
                                    A
                                  </Badge>
                                )}
                                {isRef2 && (
                                  <Badge colorScheme="purple" fontSize="xs">
                                    B
                                  </Badge>
                                )}
                              </Flex>
                              <Text fontSize="xs" noOfLines={1}>
                                {commit.summary}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {new Date(
                                  commit.timestamp,
                                ).toLocaleDateString()}
                              </Text>
                            </Box>
                          )
                        })}
                      </VStack>
                    )}
                  </TabPanel>
                  <TabPanel px={0} pb={0}>
                    {refsQuery.isPending ? (
                      <Flex justify="center" py={2}>
                        <Spinner size="sm" color="ui.main" />
                      </Flex>
                    ) : branches.length === 0 ? (
                      <Text fontSize="xs" color="gray.500">
                        No branches found.
                      </Text>
                    ) : (
                      <VStack align="stretch" spacing={1}>
                        {branches.map((branch: GitRef) => {
                          const isRef1 = branch.name === ref1
                          const isRef2 = branch.name === ref2
                          return (
                            <Box
                              key={branch.name}
                              p={2}
                              borderRadius="md"
                              cursor="pointer"
                              bg={isRef1 || isRef2 ? selectedBg : undefined}
                              _hover={{
                                bg: isRef1 || isRef2 ? selectedBg : hoverBg,
                              }}
                              onClick={() => {
                                if (!ref1 || ref1 === branch.name) {
                                  setRef1(branch.name)
                                  setRef2(undefined)
                                } else if (!ref2) {
                                  setRef2(branch.name)
                                } else {
                                  setRef1(branch.name)
                                  setRef2(undefined)
                                }
                              }}
                              borderWidth={isRef1 || isRef2 ? 1 : 0}
                              borderColor="blue.300"
                            >
                              <Flex align="center" gap={1}>
                                <Icon
                                  as={FaCodeBranch}
                                  fontSize="xs"
                                  color="gray.400"
                                  flexShrink={0}
                                />
                                <Text fontSize="xs" noOfLines={1} flex={1}>
                                  {branch.name}
                                </Text>
                                {isRef1 && (
                                  <Badge colorScheme="blue" fontSize="xs">
                                    A
                                  </Badge>
                                )}
                                {isRef2 && (
                                  <Badge colorScheme="purple" fontSize="xs">
                                    B
                                  </Badge>
                                )}
                                {branch.is_default && (
                                  <Badge colorScheme="green" fontSize="xs">
                                    default
                                  </Badge>
                                )}
                              </Flex>
                            </Box>
                          )
                        })}
                      </VStack>
                    )}
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Box>

            {/* Artifact content area */}
            <Box
              flex={1}
              minW={0}
              minH={0}
              display="flex"
              flexDirection="column"
            >
              {isComparing ? (
                <Box
                  flex={1}
                  minH={0}
                  overflow={kind === "figure" ? "hidden" : "auto"}
                >
                  {kind === "file" && displayData1 && artifact2Query.data ? (
                    (() => {
                      const decode = (
                        d: Figure | Publication | Notebook | ContentsItem,
                      ) => {
                        const item = d as ContentsItem
                        if (item.content) return atob(item.content)
                        return ""
                      }
                      return (
                        <ReactDiffViewer
                          oldValue={decode(displayData1!)}
                          newValue={decode(artifact2Query.data)}
                          leftTitle={
                            <Flex align="center" gap={1}>
                              <Badge colorScheme="blue">A</Badge>
                              <Code fontSize="xs">{ref1}</Code>
                            </Flex>
                          }
                          rightTitle={
                            <Flex align="center" gap={1}>
                              <Badge colorScheme="purple">B</Badge>
                              <Code fontSize="xs">{ref2}</Code>
                            </Flex>
                          }
                          compareMethod={DiffMethod.WORDS}
                          useDarkTheme
                          styles={{
                            variables: {
                              dark: { gutterBackground: "#1a202c" },
                            },
                          }}
                        />
                      )
                    })()
                  ) : (
                    <Flex gap={4} align="flex-start" height="100%">
                      <Box flex={1} minH={0}>
                        <Flex align="center" gap={2} mb={2}>
                          <Badge colorScheme="blue">A</Badge>
                          <Code fontSize="sm">{ref1}</Code>
                        </Flex>
                        {isPending1 ? (
                          <Spinner color="ui.main" />
                        ) : (
                          <ArtifactContent
                            kind={kind}
                            path={path}
                            data={displayData1}
                          />
                        )}
                      </Box>
                      <Divider orientation="vertical" />
                      <Box flex={1} minH={0}>
                        <Flex align="center" gap={2} mb={2}>
                          <Badge colorScheme="purple">B</Badge>
                          <Code fontSize="sm">{ref2}</Code>
                        </Flex>
                        {artifact2Query.isPending ? (
                          <Spinner color="ui.main" />
                        ) : (
                          <ArtifactContent
                            kind={kind}
                            path={path}
                            data={artifact2Query.data}
                          />
                        )}
                      </Box>
                    </Flex>
                  )}
                </Box>
              ) : (
                <>
                  {ref1 && (
                    <Flex align="center" gap={2} mb={2} flexShrink={0}>
                      <Badge colorScheme="blue">A</Badge>
                      <Code fontSize="sm">{ref1}</Code>
                      <Text fontSize="xs" color="gray.500">
                        (click another version on the left to compare)
                      </Text>
                    </Flex>
                  )}
                  <Flex flex={1} minH={0} align="stretch" gap={1}>
                    {/* Left arrow */}
                    <Flex
                      w="28px"
                      flexShrink={0}
                      align="center"
                      justify="center"
                      ml={-2}
                    >
                      {onPrev && (
                        <IconButton
                          aria-label="Previous"
                          icon={<FaChevronLeft />}
                          size="sm"
                          variant="ghost"
                          onClick={onPrev}
                        />
                      )}
                    </Flex>
                    {/* Content */}
                    <Box
                      flex={1}
                      minH={0}
                      overflow={kind === "figure" ? "hidden" : "auto"}
                    >
                      {isPending1 ? (
                        <Flex justify="center" align="center" height="200px">
                          <Spinner color="ui.main" />
                        </Flex>
                      ) : (
                        <ArtifactContent
                          kind={kind}
                          path={path}
                          data={displayData1}
                        />
                      )}
                    </Box>
                    {/* Right arrow */}
                    <Flex
                      w="28px"
                      flexShrink={0}
                      align="center"
                      justify="center"
                      mr={-2}
                    >
                      {onNext && (
                        <IconButton
                          aria-label="Next"
                          icon={<FaChevronRight />}
                          size="sm"
                          variant="ghost"
                          onClick={onNext}
                        />
                      )}
                    </Flex>
                  </Flex>
                </>
              )}
            </Box>

            {/* Figure comments panel */}
            {kind === "figure" && (
              <Box
                w="300px"
                flexShrink={0}
                borderLeftWidth={1}
                borderColor={borderColor}
                pl={3}
                overflowY="auto"
              >
                <FigureComments
                  ownerName={ownerName}
                  projectName={projectName}
                  path={path}
                  gitRef={ref1}
                />
              </Box>
            )}
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
