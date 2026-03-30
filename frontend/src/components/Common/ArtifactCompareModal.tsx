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
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { FaLink } from "react-icons/fa"

import {
  getProjectFileHistory,
  getProjectFiguresAtRef,
  getProjectPublicationsAtRef,
  getProjectNotebooksAtRef,
  getProjectContentsAtRef,
  type CommitHistory,
} from "../../lib/projectRefApi"
import FigureView from "../Figures/FigureView"
import FileContent from "../Files/FileContent"
import {
  type Figure,
  type Publication,
  type Notebook,
  type ContentsItem,
  ProjectsService,
} from "../../client"
import useAuth from "../../hooks/useAuth"

/** "file" covers auto-detected types not explicitly declared in calkit.yaml. */
export type ArtifactKind = "figure" | "publication" | "notebook" | "file"

interface ArtifactCompareModalProps {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  path: string
  kind: ArtifactKind
  initialRef?: string
  initialRef2?: string
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
    return <FigureView figure={fig} />
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
        return getProjectContentsAtRef({ ownerName, projectName, path, ref })
      }
      if (kind === "figure") {
        const figs = await getProjectFiguresAtRef({
          ownerName,
          projectName,
          ref,
        })
        // Fall back to contents API if not declared in calkit.yaml
        const found = figs.find((f) => f.path === path)
        if (found) return found
        return getProjectContentsAtRef({ ownerName, projectName, path, ref })
      }
      if (kind === "publication") {
        const pubs = await getProjectPublicationsAtRef({
          ownerName,
          projectName,
          ref,
        })
        const found = pubs.find((p) => p.path === path)
        if (found) return found
        return getProjectContentsAtRef({ ownerName, projectName, path, ref })
      }
      if (kind === "notebook") {
        const nbs = await getProjectNotebooksAtRef({
          ownerName,
          projectName,
          ref,
        })
        const found = nbs.find((n) => n.path === path)
        if (found) return found
        return getProjectContentsAtRef({ ownerName, projectName, path, ref })
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
}: {
  ownerName: string
  projectName: string
  path: string
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const [draft, setDraft] = useState("")

  const commentsQuery = useQuery({
    queryKey: ["projects", ownerName, projectName, "figure-comments", path],
    queryFn: () =>
      ProjectsService.getFigureComments({
        ownerName,
        projectName,
        figurePath: path,
      }),
  })

  const postMutation = useMutation({
    mutationFn: () =>
      ProjectsService.postFigureComment({
        ownerName,
        projectName,
        requestBody: { figure_path: path, comment: draft },
      }),
    onSuccess: () => {
      setDraft("")
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "figure-comments", path],
      })
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "figures"],
      })
    },
  })

  return (
    <Box>
      <Heading size="xs" mb={3}>
        Comments
      </Heading>
      {commentsQuery.isPending ? (
        <Spinner size="sm" />
      ) : (commentsQuery.data?.length ?? 0) === 0 ? (
        <Text fontSize="xs" color="gray.500" mb={3}>
          No comments yet.
        </Text>
      ) : (
        <VStack align="stretch" spacing={3} mb={4}>
          {commentsQuery.data?.map((c) => (
            <Flex key={c.id} gap={2}>
              <Avatar name={c.user_github_username} size="xs" mt={0.5} />
              <Box
                flex={1}
                borderWidth={1}
                borderColor={borderColor}
                borderRadius="md"
                p={2}
              >
                <Flex align="center" gap={2} mb={1}>
                  <Text fontSize="xs" fontWeight="bold">
                    {c.user_github_username}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {new Date(c.created ?? "").toLocaleDateString()}
                  </Text>
                </Flex>
                <Text fontSize="sm" whiteSpace="pre-wrap">
                  {c.comment}
                </Text>
              </Box>
            </Flex>
          ))}
        </VStack>
      )}
      {user && (
        <Box>
          <Textarea
            placeholder="Add a comment…"
            size="sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            mb={2}
          />
          <Button
            size="sm"
            isDisabled={!draft.trim()}
            isLoading={postMutation.isPending}
            onClick={() => postMutation.mutate()}
          >
            Post
          </Button>
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
}: ArtifactCompareModalProps) {
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const hoverBg = useColorModeValue("gray.50", "gray.700")
  const selectedBg = useColorModeValue("blue.50", "blue.900")

  const [ref1, setRef1] = useState<string | undefined>(initialRef)
  const [ref2, setRef2] = useState<string | undefined>(initialRef2)

  useEffect(() => {
    setRef1(initialRef)
    setRef2(initialRef2)
  }, [initialRef, initialRef2])

  const historyQuery = useQuery({
    queryKey: ["projects", ownerName, projectName, "file-history", path],
    queryFn: () =>
      getProjectFileHistory({ ownerName, projectName, path, limit: 50 }),
    enabled: isOpen,
  })

  const artifact1Query = useArtifactAtRef(
    ownerName,
    projectName,
    path,
    kind,
    ref1,
    isOpen,
  )
  const artifact2Query = useArtifactAtRef(
    ownerName,
    projectName,
    path,
    kind,
    ref2,
    isOpen && Boolean(ref2),
  )

  const isComparing = Boolean(ref2)

  const getShareUrl = () => {
    const url = new URL(window.location.href)
    if (ref1) url.searchParams.set("compare_ref", ref1)
    else url.searchParams.delete("compare_ref")
    if (ref2) url.searchParams.set("compare_ref2", ref2)
    else url.searchParams.delete("compare_ref2")
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
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxW="95vw" maxH="95vh">
        <ModalHeader pr={12}>
          <Flex align="center" gap={2}>
            <Text noOfLines={1}>{path}</Text>
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
              <Heading size="xs" mb={2}>
                Version history
              </Heading>
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
              {historyQuery.isPending ? (
                <Spinner size="sm" />
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
                        _hover={{ bg: isRef1 || isRef2 ? selectedBg : hoverBg }}
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
                          {new Date(commit.timestamp).toLocaleDateString()}
                        </Text>
                      </Box>
                    )
                  })}
                </VStack>
              )}
            </Box>

            {/* Artifact content area */}
            <Box flex={1} overflowY="auto" minW={0}>
              {isComparing ? (
                <Flex gap={4} align="flex-start" height="100%">
                  <Box flex={1}>
                    <Flex align="center" gap={2} mb={2}>
                      <Badge colorScheme="blue">A</Badge>
                      <Code fontSize="sm">{ref1}</Code>
                    </Flex>
                    {artifact1Query.isPending ? (
                      <Spinner />
                    ) : (
                      <ArtifactContent
                        kind={kind}
                        path={path}
                        data={artifact1Query.data}
                      />
                    )}
                  </Box>
                  <Divider orientation="vertical" />
                  <Box flex={1}>
                    <Flex align="center" gap={2} mb={2}>
                      <Badge colorScheme="purple">B</Badge>
                      <Code fontSize="sm">{ref2}</Code>
                    </Flex>
                    {artifact2Query.isPending ? (
                      <Spinner />
                    ) : (
                      <ArtifactContent
                        kind={kind}
                        path={path}
                        data={artifact2Query.data}
                      />
                    )}
                  </Box>
                </Flex>
              ) : (
                <>
                  {ref1 && (
                    <Flex align="center" gap={2} mb={2}>
                      <Badge colorScheme="blue">A</Badge>
                      <Code fontSize="sm">{ref1}</Code>
                      <Text fontSize="xs" color="gray.500">
                        (click another version on the left to compare)
                      </Text>
                    </Flex>
                  )}
                  {artifact1Query.isPending ? (
                    <Flex justify="center" align="center" height="200px">
                      <Spinner />
                    </Flex>
                  ) : (
                    <ArtifactContent
                      kind={kind}
                      path={path}
                      data={artifact1Query.data}
                    />
                  )}
                </>
              )}
            </Box>

            {/* Figure comments panel */}
            {kind === "figure" && (
              <Box
                w="220px"
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
                />
              </Box>
            )}
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
