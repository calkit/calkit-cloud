/**
 * PDF viewer with text-highlight annotation support.
 *
 * Highlights and comments are stored in the database via the
 * project comments API. The highlight JSON is kept in a portable format
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
  Icon,
  IconButton,
  Link,
  Spinner,
  Switch,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type MutableRefObject, useCallback, useMemo, useState } from "react"
import {
  AreaHighlight,
  Highlight,
  type IHighlight,
  type NewHighlight,
  Popup,
} from "react-pdf-highlighter"
import "react-pdf-highlighter/dist/style.css"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { FaCheck, FaGithub, FaReply, FaUndo } from "react-icons/fa"

import {
  type CommentHighlight,
  type ProjectComment,
  ProjectsService,
} from "../../client"
import useAuth from "../../hooks/useAuth"
import PdfDocumentViewer, {
  type HighlightTransform,
  type OnSelectionFinished,
} from "../Common/PdfDocumentViewer"

// ---------------------------------------------------------------------------
// Highlight shape that extends IHighlight with our DB id / comment body
// ---------------------------------------------------------------------------
export interface AnnotationHighlight extends IHighlight {
  dbId: string
  commentBody: string
  authorName: string | null
  createdAt: string
  resolved: boolean
  externalUrl: string | null
}

export function commentToHighlight(
  c: ProjectComment,
): AnnotationHighlight | null {
  if (!c.highlight || !c.id) return null
  const h = c.highlight as unknown as {
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
    externalUrl: c.external_url ?? null,
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
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Textarea
        autoFocus
        placeholder="Add a comment…"
        size="sm"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
            e.preventDefault()
            onConfirm(text.trim(), createIssue)
          }
        }}
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
  isResolving,
  onResolve,
}: {
  highlight: AnnotationHighlight
  canResolve: boolean
  isResolved: boolean
  isResolving?: boolean
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
          <Flex align="center" gap={1} wrap="wrap">
            <Text fontSize="xs" fontWeight="bold" mr={1}>
              {highlight.authorName ?? "Unknown"}
            </Text>
            <Text fontSize="xs" color="gray.500" mr="auto">
              {highlight.createdAt
                ? new Date(highlight.createdAt).toLocaleDateString()
                : ""}
            </Text>
            {highlight.externalUrl && (
              <Link href={highlight.externalUrl} isExternal color="gray.500">
                <Flex align="center" gap={0.5}>
                  <Icon as={FaGithub} boxSize={3} />
                  <ExternalLinkIcon boxSize={2.5} />
                </Flex>
              </Link>
            )}
          </Flex>
        </Box>
        {canResolve &&
          (isResolving ? (
            <Spinner size="xs" color="ui.main" />
          ) : (
            <IconButton
              aria-label={isResolved ? "Unresolve" : "Resolve"}
              icon={isResolved ? <FaUndo /> : <FaCheck />}
              size="xs"
              variant="ghost"
              colorScheme={isResolved ? "gray" : "green"}
              onClick={() => onResolve(!isResolved)}
            />
          ))}
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
  showResolved,
  onShowResolvedChange,
  currentUserId,
  onResolve,
  resolvingId,
  ownerName,
  projectName,
  publicationPath,
  artifactType = "publication",
  gitRef,
  isLoading,
}: {
  comments: ProjectComment[]
  highlights: AnnotationHighlight[]
  scrollToHighlight: (h: AnnotationHighlight) => void
  showResolved: boolean
  onShowResolvedChange: (showResolved: boolean) => void
  currentUserId: string | undefined
  onResolve: (id: string, resolved: boolean) => void
  resolvingId?: string
  ownerName: string
  projectName: string
  publicationPath?: string
  artifactType?: "publication" | "presentation"
  gitRef?: string | null
  isLoading?: boolean
}) {
  const bg = useColorModeValue("ui.secondary", "ui.darkSlate")
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [addingComment, setAddingComment] = useState(false)
  const [newCommentDraft, setNewCommentDraft] = useState("")
  const [newCommentCreateIssue, setNewCommentCreateIssue] = useState(true)
  const queryClient = useQueryClient()

  const addCommentMutation = useMutation({
    mutationFn: ({
      body,
      createIssue,
    }: { body: string; createIssue: boolean }) =>
      ProjectsService.postProjectComment({
        ownerName,
        projectName,
        requestBody: {
          artifact_path: publicationPath ?? "",
          artifact_type: artifactType,
          comment: body,
          create_github_issue: createIssue,
          git_ref: gitRef ?? null,
        },
      }),
    onSuccess: () => {
      setAddingComment(false)
      setNewCommentDraft("")
      setNewCommentCreateIssue(true)
      queryClient.invalidateQueries({
        queryKey: [
          "projects",
          ownerName,
          projectName,
          "comments",
          artifactType,
          publicationPath,
        ],
      })
    },
  })

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
          artifactType,
          publicationPath,
        ],
      })
    },
  })

  // Only show top-level comments (no parent) at the top level
  const topLevel = comments.filter((c) => !(c as any).parent_id)
  const repliesFor = (parentId: string) =>
    comments.filter((c) => (c as any).parent_id === parentId)

  const filtered = showResolved ? topLevel : topLevel.filter((c) => !c.resolved)

  const withHighlight = filtered.filter((c) => c.highlight)
  const withoutHighlight = filtered.filter((c) => !c.highlight)

  // Renders a single comment card (no reply UI — that lives at the thread level).
  // Uses avatar-outside-bubble layout: avatar floated left, content in a bordered box.
  const renderCommentCard = (c: ProjectComment, isReply = false) => {
    const hl = highlights.find((h) => h.dbId === c.id)
    const isResolved = !!c.resolved
    return (
      <Flex key={c.id} gap={2}>
        <Avatar
          name={c.user_full_name ?? c.user_github_username ?? undefined}
          size="xs"
          mt={0.5}
          flexShrink={0}
        />
        <Box
          flex={1}
          borderWidth={1}
          borderColor={isResolved ? "green.200" : borderColor}
          borderRadius="md"
          p={isReply ? 2 : 3}
          opacity={isResolved ? 0.7 : 1}
          cursor={hl ? "pointer" : "default"}
          _hover={hl ? { borderColor: "yellow.400" } : undefined}
          onClick={() => hl && scrollToHighlight(hl)}
        >
          <Flex align="center" gap={1} mb={1} wrap="wrap">
            <Text fontSize="xs" fontWeight="bold" mr={1}>
              {c.user_full_name ?? c.user_github_username}
            </Text>
            <Text fontSize="xs" color="gray.500" mr="auto">
              {c.created ? new Date(c.created).toLocaleDateString() : ""}
            </Text>
            {c.external_url && (
              <Link
                href={c.external_url}
                isExternal
                color="gray.500"
                onClick={(e) => e.stopPropagation()}
              >
                <Flex align="center" gap={0.5}>
                  <Icon as={FaGithub} boxSize={3} />
                  <ExternalLinkIcon boxSize={2.5} />
                </Flex>
              </Link>
            )}
            {!!currentUserId &&
              !isReply &&
              (resolvingId === c.id ? (
                <Spinner size="xs" color="ui.main" />
              ) : (
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
              ))}
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
                {
                  (c.highlight as unknown as { content: { text: string } })
                    .content.text
                }
              </Box>
            )}
          <Text fontSize="sm" whiteSpace="pre-wrap">
            {c.comment}
          </Text>
        </Box>
      </Flex>
    )
  }

  // Renders a top-level comment together with its flat reply thread.
  // Replies are one level deep only — the reply input always targets the
  // top-level comment, matching Google Docs threading style.
  const renderComment = (c: ProjectComment) => {
    const replies = c.id ? repliesFor(c.id) : []
    const threadId = c.id ?? null
    return (
      <Box key={c.id}>
        {renderCommentCard(c, false)}
        {replies.length > 0 && (
          <VStack align="stretch" spacing={1} mt={1} ml={4}>
            {replies.map((r) => renderCommentCard(r, true))}
          </VStack>
        )}
        {!!currentUserId && (
          <Box mt={1} ml={4}>
            {replyingToId !== threadId ? (
              <Button
                size="xs"
                variant="ghost"
                leftIcon={<Icon as={FaReply} />}
                onClick={(e) => {
                  e.stopPropagation()
                  setReplyingToId(threadId)
                  setReplyDraft("")
                }}
              >
                Reply
              </Button>
            ) : (
              <Box onClick={(e) => e.stopPropagation()}>
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
            onChange={(e) => onShowResolvedChange(e.target.checked)}
          />
        </Flex>
      </Flex>
      {isLoading ? (
        <Flex justify="center" py={2}>
          <Spinner size="sm" color="ui.main" />
        </Flex>
      ) : filtered.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          {comments.length === 0
            ? "Select text in the PDF or use the button below to add a comment."
            : "No open comments."}
        </Text>
      ) : (
        <VStack align="stretch" spacing={2}>
          {withHighlight.map((c) => renderComment(c))}
          {withoutHighlight.length > 0 && withHighlight.length > 0 && (
            <Text fontSize="xs" color="gray.500" pt={1}>
              General comments
            </Text>
          )}
          {withoutHighlight.map((c) => renderComment(c))}
        </VStack>
      )}
      {!!currentUserId && publicationPath && (
        <Box mt={3}>
          {!addingComment ? (
            <Button
              size="xs"
              variant="ghost"
              w="100%"
              onClick={() => setAddingComment(true)}
            >
              + Add comment
            </Button>
          ) : (
            <Box>
              <Textarea
                size="xs"
                placeholder="Add a comment…"
                value={newCommentDraft}
                onChange={(e) => setNewCommentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    (e.metaKey || e.ctrlKey) &&
                    newCommentDraft.trim()
                  ) {
                    e.preventDefault()
                    addCommentMutation.mutate({
                      body: newCommentDraft.trim(),
                      createIssue: newCommentCreateIssue,
                    })
                  }
                }}
                rows={3}
                mb={2}
                autoFocus
              />
              <Flex align="center" gap={3} mb={2}>
                <Checkbox
                  size="sm"
                  isChecked={newCommentCreateIssue}
                  onChange={(e) => setNewCommentCreateIssue(e.target.checked)}
                >
                  Create GitHub issue
                </Checkbox>
                <Button
                  size="xs"
                  variant="primary"
                  isDisabled={!newCommentDraft.trim()}
                  isLoading={addCommentMutation.isPending}
                  onClick={() =>
                    addCommentMutation.mutate({
                      body: newCommentDraft.trim(),
                      createIssue: newCommentCreateIssue,
                    })
                  }
                >
                  Post
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setAddingComment(false)
                    setNewCommentDraft("")
                  }}
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface PdfAnnotatorProps {
  url: string
  ownerName: string
  projectName: string
  publicationPath: string
  artifactType?: "publication" | "presentation"
  gitRef?: string | null
  showResolved?: boolean
  // When true, render page-by-page navigation (prev/next arrows + arrow keys)
  // like a slide carousel. Used for presentation PDFs; off for publications.
  pagedNav?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  externalScrollRef?: MutableRefObject<(h: any) => void>
}

export default function PdfAnnotator({
  url,
  ownerName,
  projectName,
  publicationPath,
  artifactType = "publication",
  gitRef,
  showResolved = false,
  pagedNav = false,
  externalScrollRef,
}: PdfAnnotatorProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const commentsQuery = useQuery({
    queryKey: [
      "projects",
      ownerName,
      projectName,
      "comments",
      artifactType,
      publicationPath,
    ],
    queryFn: () =>
      ProjectsService.getProjectComments({
        ownerName,
        projectName,
        artifactType,
        artifactPath: publicationPath,
      }),
  })

  const postMutation = useMutation({
    mutationFn: (data: {
      comment: string
      highlight: CommentHighlight | null
      create_github_issue: boolean
    }) =>
      ProjectsService.postProjectComment({
        ownerName,
        projectName,
        requestBody: {
          artifact_path: publicationPath,
          artifact_type: artifactType,
          comment: data.comment,
          highlight: data.highlight,
          create_github_issue: data.create_github_issue,
          git_ref: gitRef ?? null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "projects",
          ownerName,
          projectName,
          "comments",
          artifactType,
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
          artifactType,
          publicationPath,
        ],
      })
    },
  })

  const comments: ProjectComment[] = commentsQuery.data ?? []
  const visibleComments = comments.filter((c) => showResolved || !c.resolved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const highlights: AnnotationHighlight[] = useMemo(
    () =>
      visibleComments
        .map(commentToHighlight)
        .filter((h): h is AnnotationHighlight => h !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleComments],
  )

  const handleAddHighlight = useCallback(
    (newHighlight: NewHighlight, commentText: string, createIssue: boolean) => {
      postMutation.mutate({
        comment: commentText,
        highlight: {
          position: newHighlight.position as unknown as Record<string, unknown>,
          content: newHighlight.content as unknown as Record<string, unknown>,
        } as CommentHighlight,
        create_github_issue: createIssue,
      })
    },
    [postMutation],
  )

  const onSelectionFinished: OnSelectionFinished = useCallback(
    (position, content, hideTip, transformSelection) => {
      // transformSelection sets ghostHighlight on PdfHighlighter so the yellow
      // selection remains visible while the user types in the comment box
      // (typing clears document.getSelection(), which otherwise makes
      // isCollapsed=true and drops the visual selection).
      transformSelection()
      return user ? (
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
    },
    [user, handleAddHighlight],
  )

  const highlightTransform: HighlightTransform = useCallback(
    (
      highlight,
      _index,
      setTip,
      hideTip,
      _viewportToScaled,
      _screenshot,
      isScrolledTo,
    ) => {
      const annotHL = highlight as unknown as AnnotationHighlight
      const isArea = Boolean(highlight.content?.image)
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
              isResolving={
                resolveMutation.isPending &&
                resolveMutation.variables?.commentId === annotHL.dbId
              }
              onResolve={(resolved) => {
                resolveMutation.mutate({
                  commentId: annotHL.dbId,
                  resolved,
                })
                hideTip()
              }}
            />
          }
          onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
          onMouseOut={hideTip}
          key={highlight.id}
        >
          {component}
        </Popup>
      )
    },
    [user, resolveMutation],
  )

  return (
    <PdfDocumentViewer
      url={url}
      highlights={highlights}
      highlightTransform={highlightTransform}
      onSelectionFinished={onSelectionFinished}
      enableAreaSelection={(e) => e.altKey}
      externalScrollRef={externalScrollRef}
      pagedNav={pagedNav}
      source={artifactType}
    />
  )
}
