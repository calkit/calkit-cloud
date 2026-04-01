/**
 * PDF viewer with text-highlight annotation support.
 *
 * Highlights and comments are stored in the database via the
 * publication-comments API. The highlight JSON is kept in a portable format
 * (react-pdf-highlighter's ScaledPosition + content.text) so it can later be
 * serialised to git objects and synced to external trackers without a schema
 * change.
 */
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  IconButton,
  Link,
  Spinner,
  Switch,
  Text,
  Textarea,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  useRef,
  useState,
  useCallback,
  useMemo,
  type MutableRefObject,
} from "react"
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
  type IHighlight,
  type NewHighlight,
} from "react-pdf-highlighter"
import "react-pdf-highlighter/dist/style.css"
import { FaCheck, FaUndo, FaLink } from "react-icons/fa"

import { ProjectsService, type PublicationComment } from "../../client"
import useAuth from "../../hooks/useAuth"

// ---------------------------------------------------------------------------
// Highlight shape that extends IHighlight with our DB id / comment body
// ---------------------------------------------------------------------------
export interface AnnotationHighlight extends IHighlight {
  dbId: string
  commentBody: string
  authorName: string | null
  createdAt: string
  resolved: boolean
}

export function commentToHighlight(
  c: PublicationComment,
): AnnotationHighlight | null {
  if (!c.highlight || !c.id) return null
  const h = c.highlight as {
    position: IHighlight["position"]
    content: IHighlight["content"]
  }
  if (!h.position) return null
  return {
    id: c.id,
    dbId: c.id,
    position: h.position,
    content: h.content ?? {},
    comment: { text: c.comment, emoji: "" },
    commentBody: c.comment,
    authorName: c.user_full_name ?? c.user_github_username ?? null,
    createdAt: c.created ?? "",
    resolved: !!c.resolved,
  }
}

// ---------------------------------------------------------------------------
// Inline tip shown when user finishes selecting text
// ---------------------------------------------------------------------------
function AddCommentTip({
  onConfirm,
  onCancel,
}: {
  onConfirm: (text: string, createIssue: boolean) => void
  onCancel: () => void
}) {
  const [text, setText] = useState("")
  const [createIssue, setCreateIssue] = useState(true)
  const bg = useColorModeValue("white", "gray.800")
  const borderColor = useColorModeValue("gray.200", "gray.600")

  return (
    <Box
      bg={bg}
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="md"
      p={3}
      boxShadow="lg"
      w="260px"
    >
      <Textarea
        autoFocus
        placeholder="Add a comment…"
        size="sm"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        mb={2}
      />
      <Checkbox
        size="sm"
        mb={2}
        isChecked={createIssue}
        onChange={(e) => setCreateIssue(e.target.checked)}
      >
        Create GitHub issue
      </Checkbox>
      <Flex gap={2}>
        <Button
          size="xs"
          variant="primary"
          isDisabled={!text.trim()}
          onClick={() => onConfirm(text.trim(), createIssue)}
        >
          Save
        </Button>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </Flex>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Popup shown when hovering / clicking an existing highlight
// ---------------------------------------------------------------------------
function HighlightPopup({
  highlight,
  canResolve,
  isResolved,
  onResolve,
}: {
  highlight: AnnotationHighlight
  canResolve: boolean
  isResolved: boolean
  onResolve: (resolved: boolean) => void
}) {
  const bg = useColorModeValue("white", "gray.800")
  const borderColor = useColorModeValue("gray.200", "gray.600")

  return (
    <Box
      bg={bg}
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="md"
      p={3}
      boxShadow="lg"
      maxW="260px"
    >
      <Flex align="flex-start" gap={2} mb={1}>
        <Avatar name={highlight.authorName ?? undefined} size="xs" mt={0.5} />
        <Box flex={1}>
          <Text fontSize="xs" fontWeight="bold">
            {highlight.authorName ?? "Unknown"}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {highlight.createdAt
              ? new Date(highlight.createdAt).toLocaleDateString()
              : ""}
          </Text>
        </Box>
        {canResolve && (
          <IconButton
            aria-label={isResolved ? "Unresolve" : "Resolve"}
            icon={isResolved ? <FaUndo /> : <FaCheck />}
            size="xs"
            variant="ghost"
            colorScheme={isResolved ? "gray" : "green"}
            onClick={() => onResolve(!isResolved)}
          />
        )}
      </Flex>
      <Text fontSize="sm" whiteSpace="pre-wrap">
        {highlight.commentBody}
      </Text>
      {highlight.content.text && (
        <Box
          mt={2}
          pl={2}
          borderLeftWidth={2}
          borderColor="yellow.400"
          fontSize="xs"
          color="gray.500"
          fontStyle="italic"
          noOfLines={3}
        >
          {highlight.content.text}
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Comment list panel
// ---------------------------------------------------------------------------
export function CommentList({
  comments,
  highlights,
  scrollToHighlight,
  currentUserId,
  onResolve,
}: {
  comments: PublicationComment[]
  highlights: AnnotationHighlight[]
  scrollToHighlight: (h: AnnotationHighlight) => void
  currentUserId: string | undefined
  onResolve: (id: string, resolved: boolean) => void
}) {
  const bg = useColorModeValue("ui.secondary", "ui.darkSlate")
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const [showResolved, setShowResolved] = useState(false)

  const filtered = showResolved ? comments : comments.filter((c) => !c.resolved)

  const withHighlight = filtered.filter((c) => c.highlight)
  const withoutHighlight = filtered.filter((c) => !c.highlight)

  const renderComment = (c: PublicationComment) => {
    const hl = highlights.find((h) => h.dbId === c.id)
    const isResolved = !!c.resolved
    return (
      <Box
        key={c.id}
        p={3}
        borderWidth={1}
        borderColor={isResolved ? "green.200" : borderColor}
        borderRadius="md"
        opacity={isResolved ? 0.7 : 1}
        cursor={hl ? "pointer" : "default"}
        _hover={hl ? { borderColor: "yellow.400" } : undefined}
        onClick={() => hl && scrollToHighlight(hl)}
      >
        <Flex align="center" gap={2} mb={1}>
          <Avatar
            name={c.user_full_name ?? c.user_github_username ?? undefined}
            size="xs"
          />
          <Text fontSize="xs" fontWeight="bold">
            {c.user_full_name ?? c.user_github_username}
          </Text>
          <Text fontSize="xs" color="gray.500" ml="auto">
            {c.created ? new Date(c.created).toLocaleDateString() : ""}
          </Text>
          {c.external_url && (
            <Link
              href={c.external_url}
              isExternal
              onClick={(e) => e.stopPropagation()}
            >
              <FaLink size={10} />
            </Link>
          )}
          {!!currentUserId && (
            <IconButton
              aria-label={isResolved ? "Unresolve" : "Resolve"}
              icon={isResolved ? <FaUndo /> : <FaCheck />}
              size="xs"
              variant="ghost"
              colorScheme={isResolved ? "gray" : "green"}
              onClick={(e) => {
                e.stopPropagation()
                if (c.id) onResolve(c.id, !isResolved)
              }}
            />
          )}
        </Flex>
        {c.highlight &&
          (c.highlight as { content?: { text?: string } }).content?.text && (
            <Box
              mb={1}
              pl={2}
              borderLeftWidth={2}
              borderColor="yellow.400"
              fontSize="xs"
              color="gray.500"
              fontStyle="italic"
              noOfLines={2}
            >
              {(c.highlight as { content: { text: string } }).content.text}
            </Box>
          )}
        <Text fontSize="sm" whiteSpace="pre-wrap">
          {c.comment}
        </Text>
      </Box>
    )
  }

  return (
    <Box bg={bg} borderRadius="lg" p={3}>
      <Flex align="center" justify="space-between" mb={3}>
        <Heading size="sm">
          Comments ({comments.filter((c) => !c.resolved).length} open)
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
      {filtered.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          {comments.length === 0
            ? "Select text in the PDF to add a comment."
            : "No open comments."}
        </Text>
      ) : (
        <VStack align="stretch" spacing={2}>
          {withHighlight.map(renderComment)}
          {withoutHighlight.length > 0 && withHighlight.length > 0 && (
            <Text fontSize="xs" color="gray.500" pt={1}>
              General comments
            </Text>
          )}
          {withoutHighlight.map(renderComment)}
        </VStack>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface PdfAnnotatorProps {
  url: string
  ownerName: string
  projectName: string
  publicationPath: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  externalScrollRef?: MutableRefObject<(h: any) => void>
}

export default function PdfAnnotator({
  url,
  ownerName,
  projectName,
  publicationPath,
  externalScrollRef,
}: PdfAnnotatorProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  // Unique key per PdfAnnotator mount. Combined with url, this ensures
  // PdfHighlighter (a class component) always gets a fresh instance when
  // either the URL changes or this component remounts — preventing React
  // StrictMode's double-invoke of componentDidMount from reusing the same
  // PDFViewer instance and causing duplicate page renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mountKey = useMemo(() => Math.random().toString(36).slice(2), [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<(h: any) => void>(() => {})

  const commentsQuery = useQuery({
    queryKey: [
      "projects",
      ownerName,
      projectName,
      "publication-comments",
      publicationPath,
    ],
    queryFn: () =>
      ProjectsService.getPublicationComments({
        ownerName,
        projectName,
        publicationPath,
      }),
  })

  const postMutation = useMutation({
    mutationFn: (data: {
      comment: string
      highlight: Record<string, unknown> | null
      create_github_issue: boolean
    }) =>
      ProjectsService.postPublicationComment({
        ownerName,
        projectName,
        requestBody: {
          publication_path: publicationPath,
          comment: data.comment,
          highlight: data.highlight,
          create_github_issue: data.create_github_issue,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "projects",
          ownerName,
          projectName,
          "publication-comments",
          publicationPath,
        ],
      })
    },
  })

  const resolveMutation = useMutation({
    mutationFn: ({
      commentId,
      resolved,
    }: { commentId: string; resolved: boolean }) =>
      ProjectsService.patchPublicationComment({
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
          "publication-comments",
          publicationPath,
        ],
      })
    },
  })

  const comments = commentsQuery.data ?? []
  const highlights: AnnotationHighlight[] = comments
    .map(commentToHighlight)
    .filter((h): h is AnnotationHighlight => h !== null)

  const scrollToHighlight = useCallback((h: AnnotationHighlight) => {
    scrollRef.current(h)
  }, [])

  const handleAddHighlight = useCallback(
    (newHighlight: NewHighlight, commentText: string, createIssue: boolean) => {
      postMutation.mutate({
        comment: commentText,
        highlight: {
          position: newHighlight.position as unknown as Record<string, unknown>,
          content: newHighlight.content as unknown as Record<string, unknown>,
        },
        create_github_issue: createIssue,
      })
    },
    [postMutation],
  )

  return (
    <Box position="relative" height="100%" overflow="hidden">
      <PdfLoader url={url} beforeLoad={<Spinner color="ui.main" />}>
        {(pdfDocument) => (
          <PdfHighlighter
            key={`${mountKey}-${url}`}
            pdfDocument={pdfDocument}
            enableAreaSelection={(e) => e.altKey}
            onScrollChange={() => {}}
            scrollRef={(fn) => {
              scrollRef.current = fn
              if (externalScrollRef) externalScrollRef.current = fn
            }}
            onSelectionFinished={(position, content, hideTip) =>
              user ? (
                <AddCommentTip
                  onConfirm={(text, createIssue) => {
                    handleAddHighlight(
                      { position, content, comment: { text, emoji: "" } },
                      text,
                      createIssue,
                    )
                    hideTip()
                  }}
                  onCancel={hideTip}
                />
              ) : null
            }
            highlightTransform={(
              highlight,
              _index,
              setTip,
              hideTip,
              _viewportToScaled,
              _screenshot,
              isScrolledTo,
            ) => {
              const annotHL = highlight as unknown as AnnotationHighlight
              const isArea = Boolean(highlight.content.image)
              const component = isArea ? (
                <AreaHighlight
                  isScrolledTo={isScrolledTo}
                  highlight={highlight}
                  onChange={() => {}}
                />
              ) : (
                <Highlight
                  isScrolledTo={isScrolledTo}
                  position={highlight.position}
                  comment={highlight.comment}
                />
              )
              return (
                <Popup
                  popupContent={
                    <HighlightPopup
                      highlight={annotHL}
                      canResolve={!!user}
                      isResolved={annotHL.resolved}
                      onResolve={(resolved) => {
                        resolveMutation.mutate({
                          commentId: annotHL.dbId,
                          resolved,
                        })
                        hideTip()
                      }}
                    />
                  }
                  onMouseOver={(popupContent) =>
                    setTip(highlight, () => popupContent)
                  }
                  onMouseOut={hideTip}
                  key={highlight.id}
                >
                  {component}
                </Popup>
              )
            }}
            highlights={highlights}
          />
        )}
      </PdfLoader>
    </Box>
  )
}
