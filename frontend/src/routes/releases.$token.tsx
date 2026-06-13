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
  Image,
  Input,
  Link,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { FiDownload, FiExternalLink } from "react-icons/fi"

import { type ContentsItem, type ReleaseView, ReleasesService } from "../client"
import type { ApiError } from "../client/core/ApiError"
import LoadingSpinner from "../components/Common/LoadingSpinner"
import useAuth from "../hooks/useAuth"
import useCustomToast from "../hooks/useCustomToast"
import { handleError } from "../lib/errors"
import { releaseDownloadName } from "../lib/releases"

export const Route = createFileRoute("/releases/$token")({
  component: ReleaseViewer,
})

function dataUri(item: ContentsItem, mime: string): string | null {
  if (item.url) return item.url
  if (item.content) return `data:${mime};base64,${item.content}`
  return null
}

function ArtifactView({
  path,
  item,
}: {
  path: string
  item: ContentsItem
}) {
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
  token,
  release,
}: {
  token: string
  release: ReleaseView
}) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const { user } = useAuth()
  const [comment, setComment] = useState("")
  const [authorName, setAuthorName] = useState("")
  const commentsQuery = useQuery({
    queryKey: ["releases", token, "comments"],
    queryFn: () => ReleasesService.getReleaseComments({ secretToken: token }),
  })
  const mutation = useMutation({
    mutationFn: () =>
      ReleasesService.postReleaseComment({
        secretToken: token,
        requestBody: {
          comment,
          author_name: authorName || null,
        },
      }),
    onSuccess: () => {
      setComment("")
      showToast("Thanks!", "Your comment was posted.", "success")
      queryClient.invalidateQueries({
        queryKey: ["releases", token, "comments"],
      })
    },
    onError: (err: ApiError) => handleError(err, showToast),
  })
  const canComment = Boolean(user) || release.allow_anonymous_comments
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
          {!user && release.allow_anonymous_comments && (
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
          <Link href="/login" color="blue.500">
            Log in
          </Link>{" "}
          to leave a comment.
        </Text>
      )}
    </Flex>
  )
}

function ReleaseViewer() {
  const { token } = Route.useParams()
  const releaseQuery = useQuery({
    queryKey: ["releases", token],
    queryFn: () => ReleasesService.getRelease({ secretToken: token }),
    retry: false,
  })
  const release = releaseQuery.data
  const contentQuery = useQuery({
    queryKey: ["releases", token, "content"],
    queryFn: () => ReleasesService.getReleaseContent({ secretToken: token }),
    enabled: Boolean(release?.path),
    retry: false,
  })

  if (releaseQuery.isPending) {
    return <LoadingSpinner height="100vh" />
  }
  if (releaseQuery.isError || !release) {
    return (
      <Flex align="center" justify="center" h="100vh" p={4}>
        <Alert status="error" borderRadius="lg" maxW="md">
          <AlertIcon />
          This release link is invalid or has been removed.
        </Alert>
      </Flex>
    )
  }

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
    <Flex direction="column" h="100vh">
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
            {release.title || release.project_title}
          </Heading>
          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {release.owner_account_display_name} / {release.project_name}
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
        </HStack>
      </Flex>

      {/* Body: artifact + optional comments */}
      <Flex flex={1} minH={0}>
        <Box flex={1} minW={0}>
          {!release.path ? (
            <Flex align="center" justify="center" h="100%" p={4}>
              <Alert status="info" borderRadius="lg" maxW="md">
                <AlertIcon />
                This release covers the whole project. Use the download button
                where available.
              </Alert>
            </Flex>
          ) : contentQuery.isPending ? (
            <LoadingSpinner height="100%" />
          ) : item ? (
            <ArtifactView path={release.path} item={item} />
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
            <CommentsPanel token={token} release={release} />
          </Box>
        )}
      </Flex>
    </Flex>
  )
}
