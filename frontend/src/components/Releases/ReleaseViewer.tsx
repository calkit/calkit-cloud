import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Icon,
  IconButton,
  Image,
  Input,
  Link,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link as RouterLink } from "@tanstack/react-router"
import { useState } from "react"
import { FaFile, FaFolder } from "react-icons/fa"
import {
  FiArrowUp,
  FiDownload,
  FiExternalLink,
  FiFolder,
  FiX,
} from "react-icons/fi"

import {
  type ContentsItem,
  type ReleaseListItem,
  type ReleaseView,
  ReleasesService,
} from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useAuth from "../../hooks/useAuth"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"
import { releaseDestination, releaseDownloadName } from "../../lib/releases"
import LoadingSpinner from "../Common/LoadingSpinner"

export interface ReleaseLocator {
  ownerName: string
  projectName: string
  releaseName: string
  token?: string
}

function dataUri(item: ContentsItem, mime: string): string | null {
  if (item.url) return item.url
  if (item.content) return `data:${mime};base64,${item.content}`
  return null
}

function ArtifactView({ path, item }: { path: string; item: ContentsItem }) {
  const lower = path.toLowerCase()
  if (lower.endsWith(".pdf")) {
    const src = dataUri(item, "application/pdf")
    if (src)
      return (
        <embed height="100%" width="100%" type="application/pdf" src={src} />
      )
  } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    // Prefer the hosted URL; fall back to inline content. Sandboxed to limit
    // what shared HTML can do while still allowing scripts to render docs.
    const src = item.url
      ? item.url
      : item.content
        ? `data:text/html;base64,${item.content}`
        : null
    if (src)
      return (
        <iframe
          title="release"
          style={{ height: "100%", width: "100%", border: "none" }}
          src={src}
          sandbox="allow-scripts allow-popups allow-same-origin"
        />
      )
  } else if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) {
    const src = dataUri(item, "image/png")
    if (src) return <Image alt={path} src={src} maxH="100%" mx="auto" />
  }
  return (
    <Flex align="center" justify="center" h="100%">
      <Alert status="info" borderRadius="lg" maxW="md">
        <AlertIcon />
        This file type can't be previewed. Use the download button to view it.
      </Alert>
    </Flex>
  )
}

function CommentsPanel({
  loc,
  release,
}: {
  loc: ReleaseLocator
  release: ReleaseView
}) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const { user } = useAuth()
  const [comment, setComment] = useState("")
  const [authorName, setAuthorName] = useState("")
  const commentsKey = [
    "releases",
    loc.ownerName,
    loc.projectName,
    loc.releaseName,
    "comments",
  ]
  const commentsQuery = useQuery({
    queryKey: commentsKey,
    queryFn: () =>
      ReleasesService.getReleaseComments({
        ownerName: loc.ownerName,
        projectName: loc.projectName,
        releaseName: loc.releaseName,
        token: loc.token,
      }),
  })
  const mutation = useMutation({
    mutationFn: () =>
      ReleasesService.postReleaseComment({
        ownerName: loc.ownerName,
        projectName: loc.projectName,
        releaseName: loc.releaseName,
        token: loc.token,
        requestBody: { comment, author_name: authorName || null },
      }),
    onSuccess: () => {
      setComment("")
      showToast("Thanks!", "Your comment was posted.", "success")
      queryClient.invalidateQueries({ queryKey: commentsKey })
    },
    onError: (err: ApiError) => handleError(err, showToast),
  })
  // The page payload already encodes whether this viewer may comment.
  const canComment =
    release.permission === "comment" || release.permission === "manage"
  // A token bound to an email identifies the commenter; only truly anonymous
  // viewers (no login, no token email) need to type a name.
  const needsName = !user && !release.viewer_email
  const comments = commentsQuery.data ?? []

  return (
    <Flex direction="column" h="100%">
      <Heading size="sm" mb={3}>
        Comments
      </Heading>
      <VStack align="stretch" spacing={3} flex={1} overflowY="auto" mb={3}>
        {commentsQuery.isPending ? (
          <LoadingSpinner height="80px" />
        ) : comments.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            No comments yet. Be the first to leave feedback.
          </Text>
        ) : (
          comments.map((c) => (
            <Box key={c.id} borderWidth="1px" borderRadius="md" p={2}>
              <Flex justify="space-between" align="baseline">
                <Text fontSize="sm" fontWeight="semibold">
                  {c.author_name || "Anonymous"}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {new Date(c.created).toLocaleDateString()}
                </Text>
              </Flex>
              <Text fontSize="sm" whiteSpace="pre-wrap">
                {c.comment}
              </Text>
              {c.external_url && (
                <Link
                  href={c.external_url}
                  isExternal
                  fontSize="xs"
                  color="blue.500"
                >
                  View on GitHub <Icon as={FiExternalLink} mb="-2px" />
                </Link>
              )}
            </Box>
          ))
        )}
      </VStack>
      <Divider mb={3} />
      {canComment ? (
        <Box>
          {release.viewer_email && (
            <Text fontSize="xs" color="gray.500" mb={2}>
              Commenting as {release.viewer_email}
            </Text>
          )}
          {needsName && (
            <FormControl mb={2}>
              <FormLabel fontSize="sm" mb={1}>
                Name (optional)
              </FormLabel>
              <Input
                size="sm"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name"
              />
            </FormControl>
          )}
          <Textarea
            size="sm"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Leave a comment"
            mb={2}
          />
          <Button
            size="sm"
            variant="primary"
            isDisabled={!comment.trim()}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Post comment
          </Button>
        </Box>
      ) : (
        <Text fontSize="sm" color="gray.500">
          This link is view-only.
        </Text>
      )}
    </Flex>
  )
}

// Read-only browser over a whole-project release's files at its pinned ref.
function ProjectBrowser({ loc }: { loc: ReleaseLocator }) {
  const [path, setPath] = useState<string | undefined>(undefined)
  const {
    data: item,
    isPending,
    isError,
  } = useQuery({
    queryKey: [
      "releases",
      loc.ownerName,
      loc.projectName,
      loc.releaseName,
      "contents",
      path ?? "",
    ],
    queryFn: () =>
      ReleasesService.getReleaseContents({
        ownerName: loc.ownerName,
        projectName: loc.projectName,
        releaseName: loc.releaseName,
        token: loc.token,
        path,
      }),
    retry: false,
  })
  const parts = path ? path.split("/") : []
  const goUp = () =>
    setPath(parts.length > 1 ? parts.slice(0, -1).join("/") : undefined)
  if (isPending) return <LoadingSpinner height="100%" />
  if (isError || !item) {
    return (
      <Flex align="center" justify="center" h="100%" p={4}>
        <Alert status="warning" borderRadius="lg" maxW="md">
          <AlertIcon />
          Couldn't load the project files.
        </Alert>
      </Flex>
    )
  }
  const isDir = item.type === "dir" || item.dir_items != null
  if (!isDir) {
    return (
      <Flex direction="column" h="100%">
        <Button
          onClick={goUp}
          leftIcon={<Icon as={FiArrowUp} />}
          size="sm"
          variant="ghost"
          m={2}
          alignSelf="flex-start"
        >
          Back to {parts.length > 1 ? parts.slice(0, -1).join("/") : "files"}
        </Button>
        <Box flex={1} minH={0}>
          <ArtifactView path={item.path} item={item} />
        </Box>
      </Flex>
    )
  }
  const entries = [...(item.dir_items ?? [])].sort((a, b) => {
    const ad = a.type === "dir" ? 0 : 1
    const bd = b.type === "dir" ? 0 : 1
    return ad - bd || a.name.localeCompare(b.name)
  })
  return (
    <Box p={4} h="100%" overflowY="auto">
      <Text fontSize="sm" color="gray.500" mb={2}>
        /{path ?? ""}
      </Text>
      <VStack align="stretch" spacing={0} maxW="container.sm">
        {path && (
          <Flex
            align="center"
            gap={2}
            py={1.5}
            px={2}
            cursor="pointer"
            borderRadius="md"
            _hover={{ bg: "blackAlpha.50" }}
            onClick={goUp}
          >
            <Icon as={FiArrowUp} color="gray.400" />
            <Text fontSize="sm">..</Text>
          </Flex>
        )}
        {entries.map((e) => (
          <Flex
            key={e.path}
            align="center"
            gap={2}
            py={1.5}
            px={2}
            cursor="pointer"
            borderRadius="md"
            _hover={{ bg: "blackAlpha.50" }}
            onClick={() => setPath(e.path)}
          >
            <Icon
              as={e.type === "dir" ? FaFolder : FaFile}
              color={e.type === "dir" ? "blue.400" : "gray.400"}
              flexShrink={0}
            />
            <Text fontSize="sm" noOfLines={1}>
              {e.name}
            </Text>
          </Flex>
        ))}
      </VStack>
    </Box>
  )
}

interface ReleaseViewerProps {
  loc: ReleaseLocator
  // When set, a close affordance is shown (used when embedded in a modal).
  onClose?: () => void
}

function ReleaseUnavailable() {
  return (
    <Flex align="center" justify="center" h="100%" p={4}>
      <Alert status="error" borderRadius="lg" maxW="md">
        <AlertIcon />
        This release is unavailable, or you need a valid share link to view it.
      </Alert>
    </Flex>
  )
}

// Resolves a release and renders the right view: a cloud (internal, hosted)
// release with its artifact/project browser and comments, or a release
// declared in calkit.yaml (published to an external venue, or a CLI-made
// snapshot) shown as metadata with a link to browse the project at its commit.
export default function ReleaseViewer({ loc, onClose }: ReleaseViewerProps) {
  const viewQuery = useQuery({
    queryKey: [
      "releases",
      loc.ownerName,
      loc.projectName,
      loc.releaseName,
      loc.token,
    ],
    queryFn: () =>
      ReleasesService.getReleaseView({
        ownerName: loc.ownerName,
        projectName: loc.projectName,
        releaseName: loc.releaseName,
        token: loc.token,
      }),
    retry: false,
  })
  // calkit.yaml releases have no cloud row, so getReleaseView 404s; fall back
  // to their metadata from the project's releases listing.
  const listQuery = useQuery({
    queryKey: [
      "projects",
      loc.ownerName,
      loc.projectName,
      "releases",
      undefined,
    ],
    queryFn: () =>
      ReleasesService.getProjectReleases({
        ownerName: loc.ownerName,
        projectName: loc.projectName,
      }),
    enabled: viewQuery.isError,
    retry: false,
  })

  if (viewQuery.isPending) return <LoadingSpinner height="100%" />
  if (viewQuery.data)
    return (
      <CloudReleaseView loc={loc} release={viewQuery.data} onClose={onClose} />
    )
  if (listQuery.isPending) return <LoadingSpinner height="100%" />
  const calkit = (listQuery.data ?? []).find(
    (r) => r.name === loc.releaseName && r.source !== "cloud",
  )
  if (calkit)
    return <CalkitReleaseView loc={loc} release={calkit} onClose={onClose} />
  return <ReleaseUnavailable />
}

// A release declared in calkit.yaml: show its metadata and where it went, with
// a link to browse the project at the pinned commit (via the ref query param).
function CalkitReleaseView({
  loc,
  release,
  onClose,
}: {
  loc: ReleaseLocator
  release: ReleaseListItem
  onClose?: () => void
}) {
  const dest = releaseDestination(release)
  const gitRev = release.git_rev ?? release.git_rev_abbrev ?? undefined
  const isWholeProject = !release.path || release.path === "."
  return (
    <Flex direction="column" h="100%">
      <Flex
        as="header"
        align="center"
        justify="space-between"
        px={4}
        py={2}
        borderBottomWidth="1px"
        gap={3}
        flexWrap="wrap"
      >
        <Box minW={0}>
          <Heading size="sm" noOfLines={1}>
            {release.title || release.name}
          </Heading>
          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {loc.ownerName} / {loc.projectName}
            {isWholeProject ? " · whole project" : ` · ${release.path}`}
          </Text>
        </Box>
        <HStack spacing={3} flexShrink={0}>
          {release.git_ref || release.git_rev_abbrev ? (
            <HStack spacing={1}>
              <Text fontSize="sm" color="gray.500">
                Version
              </Text>
              <Badge>{release.git_ref ?? release.git_rev_abbrev}</Badge>
            </HStack>
          ) : null}
          {onClose && (
            <IconButton
              aria-label="Close"
              icon={<FiX />}
              size="sm"
              variant="ghost"
              onClick={onClose}
            />
          )}
        </HStack>
      </Flex>
      <Box flex={1} overflowY="auto" p={6}>
        <VStack align="stretch" spacing={4} maxW="container.sm" mx="auto">
          <Box>
            <Text fontSize="xs" color="gray.500" textTransform="uppercase">
              Destination
            </Text>
            <HStack mt={1}>
              <Badge colorScheme={dest.internal ? "blue" : "purple"}>
                {dest.label}
              </Badge>
              {dest.href && (
                <Link
                  href={dest.href}
                  isExternal
                  color="blue.500"
                  fontSize="sm"
                >
                  {release.doi ?? "View"} <Icon as={FiExternalLink} mb="-2px" />
                </Link>
              )}
            </HStack>
          </Box>
          {release.kind && (
            <Box>
              <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                Kind
              </Text>
              <Text fontSize="sm">{release.kind}</Text>
            </Box>
          )}
          {release.date && (
            <Box>
              <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                Released
              </Text>
              <Text fontSize="sm">
                {new Date(release.date).toLocaleDateString()}
              </Text>
            </Box>
          )}
          {release.description && (
            <Box>
              <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                Description
              </Text>
              <Text fontSize="sm" whiteSpace="pre-wrap">
                {release.description}
              </Text>
            </Box>
          )}
          {gitRev && (
            <Box pt={2}>
              <Link
                as={RouterLink}
                to={`/${loc.ownerName}/${loc.projectName}` as any}
                search={{ ref: gitRev } as any}
              >
                <Button size="sm" leftIcon={<FiFolder />}>
                  Browse project at this version
                </Button>
              </Link>
            </Box>
          )}
        </VStack>
      </Box>
    </Flex>
  )
}

function CloudReleaseView({
  loc,
  release,
  onClose,
}: {
  loc: ReleaseLocator
  release: ReleaseView
  onClose?: () => void
}) {
  const isWholeProject = !release.path || release.path === "."
  const contentQuery = useQuery({
    queryKey: [
      "releases",
      loc.ownerName,
      loc.projectName,
      loc.releaseName,
      "content",
    ],
    queryFn: () =>
      ReleasesService.getReleaseContent({
        ownerName: loc.ownerName,
        projectName: loc.projectName,
        releaseName: loc.releaseName,
        token: loc.token,
      }),
    enabled: Boolean(release.path) && !isWholeProject,
    retry: false,
  })

  const refLabel = release.git_ref ?? release.git_rev_abbrev ?? ""
  const item = contentQuery.data
  const downloadHref = item
    ? item.url ??
      (item.content
        ? `data:application/octet-stream;base64,${item.content}`
        : undefined)
    : undefined
  const downloadName = release.path
    ? releaseDownloadName(release.path, refLabel)
    : undefined

  return (
    <Flex direction="column" h="100%">
      {/* Header / provenance bar */}
      <Flex
        as="header"
        align="center"
        justify="space-between"
        px={4}
        py={2}
        borderBottomWidth="1px"
        gap={3}
        flexWrap="wrap"
      >
        <Box minW={0}>
          <Heading size="sm" noOfLines={1}>
            {release.title || release.name}
          </Heading>
          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {release.owner_account_display_name} / {release.project_name}
            {isWholeProject ? " · whole project" : ` · ${release.path}`}
          </Text>
        </Box>
        <HStack spacing={3} flexShrink={0}>
          <HStack spacing={1}>
            <Text fontSize="sm" color="gray.500">
              Version
            </Text>
            <Badge>{refLabel}</Badge>
          </HStack>
          {downloadHref && downloadName && (
            <Button
              as="a"
              href={downloadHref}
              download={downloadName}
              size="sm"
              leftIcon={<FiDownload />}
            >
              Download
            </Button>
          )}
          {onClose && (
            <IconButton
              aria-label="Close"
              icon={<FiX />}
              size="sm"
              variant="ghost"
              onClick={onClose}
            />
          )}
        </HStack>
      </Flex>

      {/* Body: artifact + optional comments */}
      <Flex flex={1} minH={0}>
        <Box flex={1} minW={0}>
          {isWholeProject ? (
            <ProjectBrowser loc={loc} />
          ) : contentQuery.isPending ? (
            <LoadingSpinner height="100%" />
          ) : item ? (
            <ArtifactView path={release.path ?? ""} item={item} />
          ) : (
            <Flex align="center" justify="center" h="100%" p={4}>
              <Alert status="warning" borderRadius="lg" maxW="md">
                <AlertIcon />
                Couldn't load the released file.
              </Alert>
            </Flex>
          )}
        </Box>
        {release.comments_enabled && (
          <Box
            w="340px"
            flexShrink={0}
            borderLeftWidth="1px"
            p={4}
            overflowY="auto"
          >
            <CommentsPanel loc={loc} release={release} />
          </Box>
        )}
      </Flex>
    </Flex>
  )
}
