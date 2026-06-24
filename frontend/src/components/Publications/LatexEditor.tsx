import {
  Badge,
  Box,
  Button,
  Collapse,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Spinner,
  Text,
  useDisclosure,
} from "@chakra-ui/react"
import { StreamLanguage } from "@codemirror/language"
import { stex } from "@codemirror/legacy-modes/mode/stex"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EditorView, basicSetup } from "codemirror"
import { type MutableRefObject, useEffect, useRef, useState } from "react"

import { ProjectsService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { LatexCompiler } from "../../lib/latexCompiler"
import { handleError } from "../../lib/errors"
import PdfDocumentViewer from "../Common/PdfDocumentViewer"

interface LatexEditorProps {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  texPath: string
}

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function EditorPane({
  initialDoc,
  viewRef,
  onChange,
}: {
  initialDoc: string
  viewRef: MutableRefObject<EditorView | null>
  onChange: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const view = new EditorView({
      doc: initialDoc,
      extensions: [
        basicSetup,
        StreamLanguage.define(stex),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            onChange()
          }
        }),
      ],
      parent: ref.current,
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])
  return <Box ref={ref} height="100%" overflowY="auto" fontSize="sm" />
}

const LatexEditor = ({
  isOpen,
  onClose,
  ownerName,
  projectName,
  texPath,
}: LatexEditorProps) => {
  const viewRef = useRef<EditorView | null>(null)
  const compilerRef = useRef<LatexCompiler | null>(null)
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const logPanel = useDisclosure()
  const [log, setLog] = useState("")
  const [status, setStatus] = useState("")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [dirty, setDirty] = useState(false)
  const mainName = texPath.split("/").pop() || texPath

  const { data: contents, isLoading } = useQuery({
    queryKey: ["projects", ownerName, projectName, "contents", texPath],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName,
        projectName,
        path: texPath,
      }),
    enabled: isOpen,
    staleTime: 0,
  })

  useEffect(() => {
    return () => {
      compilerRef.current?.terminate()
      compilerRef.current = null
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [])

  const compile = async () => {
    const view = viewRef.current
    if (!view) {
      return
    }
    setCompiling(true)
    setLog("")
    setStatus("Loading engine & compiling…")
    try {
      if (!compilerRef.current) {
        compilerRef.current = new LatexCompiler({
          onLog: (line) => setLog((l) => `${l}${line}\n`),
        })
      }
      const source = view.state.doc.toString()
      const result = await compilerRef.current.compile(
        [{ path: mainName, contents: source }],
        mainName,
      )
      if (result.exitCode === 0 && result.pdf) {
        const blob = new Blob([result.pdf], { type: "application/pdf" })
        setPdfUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev)
          }
          return URL.createObjectURL(blob)
        })
        setStatus("Compiled ✓")
      } else {
        setStatus(`Compile failed (exit ${result.exitCode})`)
        setLog(result.log)
        logPanel.onOpen()
      }
    } catch (e) {
      setStatus("Engine error")
      setLog(String(e))
      logPanel.onOpen()
    } finally {
      setCompiling(false)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const source = viewRef.current?.state.doc.toString() ?? ""
      const file = new File([source], mainName, { type: "text/plain" })
      return ProjectsService.putProjectContents({
        ownerName,
        projectName,
        path: texPath,
        contentLength: file.size,
        formData: { file },
      })
    },
    onSuccess: () => {
      setDirty(false)
      showToast("Saved", "Your changes were committed.", "success")
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName],
      })
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
  })

  const handleClose = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) {
      return
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="full">
      <ModalOverlay />
      <ModalContent>
        <Flex align="center" gap={3} px={4} py={2} borderBottomWidth="1px">
          <Text fontWeight="bold">{mainName}</Text>
          {dirty && (
            <Badge colorScheme="orange" variant="subtle">
              Unsaved
            </Badge>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={compile}
            isLoading={compiling}
          >
            Compile preview
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
            isDisabled={!dirty}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={logPanel.onToggle}>
            {logPanel.isOpen ? "Hide log" : "Show log"}
          </Button>
          <Text fontSize="sm" color="ui.dim">
            {status}
          </Text>
          <Box flex="1" />
          <Text fontSize="xs" color="ui.dim">
            Draft preview — not the published PDF
          </Text>
          <ModalCloseButton position="static" />
        </Flex>
        <ModalBody p={0} overflow="hidden">
          <Flex height="calc(100vh - 49px)">
            <Box flex="1" borderRightWidth="1px" minW={0}>
              {isLoading ? (
                <Flex height="100%" align="center" justify="center">
                  <Spinner />
                </Flex>
              ) : (
                <EditorPane
                  initialDoc={
                    contents?.content ? decodeBase64Utf8(contents.content) : ""
                  }
                  viewRef={viewRef}
                  onChange={() => setDirty(true)}
                />
              )}
            </Box>
            <Box flex="1" minW={0} position="relative" bg="blackAlpha.50">
              {pdfUrl ? (
                <PdfDocumentViewer url={pdfUrl} />
              ) : (
                <Flex
                  height="100%"
                  align="center"
                  justify="center"
                  direction="column"
                  gap={2}
                  color="ui.dim"
                >
                  <Text>No preview yet.</Text>
                  <Text fontSize="sm">
                    Click "Compile preview" to render the PDF.
                  </Text>
                </Flex>
              )}
              <Collapse in={logPanel.isOpen}>
                <Box
                  position="absolute"
                  bottom={0}
                  left={0}
                  right={0}
                  maxH="40%"
                  overflowY="auto"
                  bg="gray.900"
                  color="gray.100"
                  fontFamily="mono"
                  fontSize="xs"
                  whiteSpace="pre-wrap"
                  p={2}
                >
                  {log || "(no output)"}
                </Box>
              </Collapse>
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default LatexEditor
