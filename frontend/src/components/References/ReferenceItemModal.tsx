import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Tr,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { FaMapMarkerAlt, FaPlus, FaTrash } from "react-icons/fa"
import { Highlight, type IHighlight, Popup } from "react-pdf-highlighter"

import {
  type ApiError,
  ProjectsService,
  type ReferenceEntry,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { formatBibField } from "../../lib/bibtex"
import { apiUrl } from "../../lib/core"
import { handleError } from "../../lib/errors"
import LoadingSpinner from "../Common/LoadingSpinner"
import PdfDocumentViewer, {
  type HighlightTransform,
  type OnSelectionFinished,
} from "../Common/PdfDocumentViewer"
import { AddCommentTip } from "../Publications/PdfAnnotator"

interface ReferenceItemModalProps {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  bibPath: string
  entry?: ReferenceEntry
  userHasWriteAccess: boolean
}

// A note being edited: text plus an optional PDF highlight anchor.
interface NoteHighlight {
  // react-pdf-highlighter ScaledPosition.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  position: any
  quote: string
}
interface EditableNote {
  text: string
  highlight?: NoteHighlight | null
}

const ReferenceItemModal = ({
  isOpen,
  onClose,
  ownerName,
  projectName,
  bibPath,
  entry,
  userHasWriteAccess,
}: ReferenceItemModalProps) => {
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const [pdfUrl, setPdfUrl] = useState<string>()
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const [notes, setNotes] = useState<EditableNote[]>([])
  const objectUrlRef = useRef<string>()
  const title = entry?.attrs?.title
    ? formatBibField("title", String(entry.attrs.title))
    : entry?.key
  const hasZotero = Boolean(entry?.zotero_item_key)

  // Load the PDF: prefer the Zotero attachment (proxied, needs auth), else the
  // repo-stored file's presigned URL.
  useEffect(() => {
    if (!isOpen || !entry) return
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = undefined
    }
    setPdfUrl(undefined)
    setPdfError(false)
    if (entry.has_pdf) {
      setPdfLoading(true)
      const url =
        `${apiUrl}/projects/${ownerName}/${projectName}/zotero/items/` +
        `${encodeURIComponent(entry.key)}/pdf?path=${encodeURIComponent(bibPath)}`
      fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load PDF")
          return r.blob()
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob)
          objectUrlRef.current = objectUrl
          setPdfUrl(objectUrl)
        })
        .catch(() => setPdfError(true))
        .finally(() => setPdfLoading(false))
    } else if (entry.url) {
      setPdfUrl(entry.url)
    }
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = undefined
      }
    }
  }, [isOpen, entry, ownerName, projectName, bibPath])

  const notesKey = [
    "projects",
    ownerName,
    projectName,
    "reference-notes",
    bibPath,
    entry?.key,
  ]
  const notesQuery = useQuery({
    queryKey: notesKey,
    queryFn: () =>
      ProjectsService.getProjectReferenceNotes({
        ownerName,
        projectName,
        bibKey: entry!.key,
        path: bibPath,
      }),
    enabled: isOpen && Boolean(entry),
  })
  // Reset the editable notes whenever the server copy changes.
  useEffect(() => {
    if (notesQuery.data) {
      setNotes(
        notesQuery.data.notes.map((n) => ({
          text: n.text,
          highlight: n.highlight
            ? {
                position: n.highlight.position,
                quote: n.highlight.quote ?? "",
              }
            : null,
        })),
      )
    }
  }, [notesQuery.data])

  const saveNotesMutation = useMutation({
    mutationFn: (toSave: EditableNote[]) =>
      ProjectsService.putProjectReferenceNotes({
        ownerName,
        projectName,
        bibKey: entry!.key,
        requestBody: {
          path: bibPath,
          // Keep notes with text or an anchor; drop truly empty ones.
          notes: toSave
            .filter((n) => n.text.trim() || n.highlight)
            .map((n) => ({
              text: n.text,
              highlight: n.highlight
                ? {
                    position: n.highlight.position,
                    quote: n.highlight.quote,
                  }
                : null,
            })),
        },
      }),
    onSuccess: () => {
      showToast(
        "Success!",
        hasZotero ? "Notes saved to Zotero." : "Note saved.",
        "success",
      )
      queryClient.invalidateQueries({ queryKey: notesKey })
      // The note count on the list comes from the references query.
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "references"],
      })
    },
    onError: (err: ApiError) => handleError(err, showToast),
  })

  // PDF highlight anchoring: map notes that carry an anchor to highlights the
  // viewer can render, and let a text selection create a new anchored note.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollToRef = useRef<(h: any) => void>(() => {})
  const noteToHighlight = (note: EditableNote, i: number): IHighlight => ({
    id: `note-${i}`,
    position: note.highlight!.position,
    content: { text: note.highlight!.quote },
    comment: { text: note.text, emoji: "" },
  })
  const highlights = useMemo(
    () =>
      notes
        .map((n, i): IHighlight | null =>
          n.highlight
            ? {
                id: `note-${i}`,
                position: n.highlight.position,
                content: { text: n.highlight.quote },
                comment: { text: n.text, emoji: "" },
              }
            : null,
        )
        .filter((h): h is IHighlight => h !== null),
    [notes],
  )
  const addAnchoredNote = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    position: any,
    quote: string,
    text: string,
  ) => {
    const next = [...notes, { text, highlight: { position, quote } }]
    setNotes(next)
    saveNotesMutation.mutate(next)
  }
  const onSelectionFinished: OnSelectionFinished = (
    position,
    content,
    hideTip,
    transformSelection,
  ) => {
    if (!userHasWriteAccess) return null
    transformSelection()
    return (
      <AddCommentTip
        hideIssueCheckbox
        onConfirm={(text) => {
          addAnchoredNote(position, content.text ?? "", text)
          hideTip()
        }}
        onCancel={hideTip}
      />
    )
  }
  const highlightTransform: HighlightTransform = (
    highlight,
    _index,
    setTip,
    hideTip,
    _viewportToScaled,
    _screenshot,
    isScrolledTo,
  ) => (
    <Popup
      key={highlight.id}
      popupContent={
        <Box p={2} maxW="260px" fontSize="sm" whiteSpace="pre-wrap">
          {highlight.comment?.text || "(empty note)"}
        </Box>
      }
      onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
      onMouseOut={hideTip}
    >
      <Highlight
        isScrolledTo={isScrolledTo}
        position={highlight.position}
        comment={highlight.comment}
      />
    </Popup>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader pr={10} noOfLines={1}>
          {title}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Flex gap={4} h="85vh">
            {/* Center: PDF. Wait for notes too, so highlights are present when
                the highlighter mounts (it doesn't reliably re-anchor an
                async-arriving highlights prop). */}
            <Box flex={1} minW={0} borderWidth={1} borderRadius="md">
              {pdfLoading || (pdfUrl && notesQuery.isPending) ? (
                <LoadingSpinner />
              ) : pdfUrl ? (
                <PdfDocumentViewer
                  url={pdfUrl}
                  source="reference"
                  defaultScale="page-width"
                  highlights={highlights}
                  highlightTransform={highlightTransform}
                  onSelectionFinished={onSelectionFinished}
                  externalScrollRef={scrollToRef}
                />
              ) : (
                <Flex h="100%" align="center" justify="center">
                  <Text color="gray.500" fontSize="sm">
                    {pdfError
                      ? "Could not load the PDF."
                      : "No PDF attached to this reference."}
                  </Text>
                </Flex>
              )}
            </Box>
            {/* Right: metadata + notes */}
            <Box w="360px" flexShrink={0} overflowY="auto">
              <Heading size="sm" mb={2}>
                Details
              </Heading>
              <Table variant="simple" size="sm" mb={4}>
                <Tbody>
                  <Tr>
                    <Td fontWeight="semibold" w="90px">
                      key
                    </Td>
                    <Td>{entry?.key}</Td>
                  </Tr>
                  <Tr>
                    <Td fontWeight="semibold">type</Td>
                    <Td>{entry?.type}</Td>
                  </Tr>
                  {entry?.attrs
                    ? Object.entries(entry.attrs).map(([k, v]) => {
                        const value = formatBibField(k, String(v))
                        const key = k.toLowerCase()
                        const href =
                          key === "doi"
                            ? value.startsWith("http")
                              ? value
                              : `https://doi.org/${value}`
                            : key === "url"
                              ? value
                              : undefined
                        return (
                          <Tr key={k}>
                            <Td fontWeight="semibold">{k}</Td>
                            <Td>
                              {href ? (
                                <Link href={href} isExternal variant="blue">
                                  {value}
                                </Link>
                              ) : (
                                value
                              )}
                            </Td>
                          </Tr>
                        )
                      })
                    : null}
                </Tbody>
              </Table>
              <Flex align="center" mb={2}>
                <Heading size="sm">Notes</Heading>
                {userHasWriteAccess ? (
                  <IconButton
                    aria-label="Add note"
                    icon={<FaPlus />}
                    size="xs"
                    variant="ghost"
                    ml={2}
                    onClick={() => setNotes((ns) => [...ns, { text: "" }])}
                  />
                ) : null}
              </Flex>
              {notesQuery.isPending ? (
                <LoadingSpinner height="80px" />
              ) : (
                <VStack align="stretch" spacing={3}>
                  {notes.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">
                      No notes yet.
                    </Text>
                  ) : (
                    notes.map((note, i) => (
                      <Flex key={i} gap={1} align="start">
                        <VStack flex={1} align="stretch" spacing={1}>
                          {note.highlight ? (
                            <Flex align="center" gap={1}>
                              <IconButton
                                aria-label="Show on PDF"
                                icon={<FaMapMarkerAlt />}
                                size="xs"
                                variant="ghost"
                                onClick={() =>
                                  scrollToRef.current(noteToHighlight(note, i))
                                }
                              />
                              <Text
                                flex={1}
                                fontSize="xs"
                                color="gray.500"
                                fontStyle="italic"
                                noOfLines={2}
                                borderLeftWidth={2}
                                borderColor="yellow.400"
                                pl={2}
                              >
                                {note.highlight.quote}
                              </Text>
                            </Flex>
                          ) : null}
                          <Textarea
                            size="sm"
                            rows={3}
                            placeholder="Note"
                            value={note.text}
                            isReadOnly={!userHasWriteAccess}
                            onChange={(e) =>
                              setNotes((ns) =>
                                ns.map((n, j) =>
                                  j === i ? { ...n, text: e.target.value } : n,
                                ),
                              )
                            }
                            onKeyDown={(e) => {
                              if (
                                (e.metaKey || e.ctrlKey) &&
                                e.key === "Enter" &&
                                userHasWriteAccess
                              ) {
                                e.preventDefault()
                                saveNotesMutation.mutate(notes)
                              }
                            }}
                          />
                        </VStack>
                        {userHasWriteAccess ? (
                          <IconButton
                            aria-label="Remove note"
                            icon={<FaTrash />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() =>
                              setNotes((ns) => ns.filter((_, j) => j !== i))
                            }
                          />
                        ) : null}
                      </Flex>
                    ))
                  )}
                  {userHasWriteAccess ? (
                    <Button
                      size="sm"
                      variant="primary"
                      alignSelf="flex-start"
                      onClick={() => saveNotesMutation.mutate(notes)}
                      isLoading={saveNotesMutation.isPending}
                    >
                      Save notes
                    </Button>
                  ) : null}
                </VStack>
              )}
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ReferenceItemModal
