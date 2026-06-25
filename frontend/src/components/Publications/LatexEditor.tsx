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
  VStack,
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
import { LatexCompiler, type LatexFile } from "../../lib/latexCompiler"
import { loadLatexProject } from "../../lib/latexProject"
import { handleError } from "../../lib/errors"
import PdfDocumentViewer from "../Common/PdfDocumentViewer"

interface LatexEditorProps {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  texPath: string
}

function EditorPane({
  initialDoc,
  viewRef,
  onChange,
}: {
  initialDoc: string
  viewRef: MutableRefObject<EditorView | null>
  onChange: (text: string) => void
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
            onChange(u.state.doc.toString())
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
  const baseDir = texPath.includes("/")
    ? texPath.slice(0, texPath.lastIndexOf("/"))
    : ""
  const mainRelPath = baseDir ? texPath.slice(baseDir.length + 1) : texPath

  const viewRef = useRef<EditorView | null>(null)
  const compilerRef = useRef<LatexCompiler | null>(null)
  const buffersRef = useRef<Map<string, string>>(new Map())
  const binariesRef = useRef<Map<string, Uint8Array>>(new Map())
  const initializedRef = useRef(false)
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const logPanel = useDisclosure()
  const [textPaths, setTextPaths] = useState<string[]>([])
  const [activePath, setActivePath] = useState<string>(mainRelPath)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [log, setLog] = useState("")
  const [status, setStatus] = useState("")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(false)

  const { data: projectFiles, isLoading } = useQuery({
    queryKey: ["projects", ownerName, projectName, "latex-project", baseDir],
    queryFn: () => loadLatexProject(ownerName, projectName, baseDir),
    enabled: isOpen,
    staleTime: 0,
  })

  useEffect(() => {
    if (!projectFiles || initializedRef.current) {
      return
    }
    initializedRef.current = true
    const texts: string[] = []
    for (const f of projectFiles) {
      if (f.kind === "text") {
        buffersRef.current.set(f.relPath, f.text ?? "")
        texts.push(f.relPath)
      } else if (f.bytes) {
        binariesRef.current.set(f.relPath, f.bytes)
      }
    }
    texts.sort()
    setTextPaths(texts)
    setActivePath(
      texts.includes(mainRelPath) ? mainRelPath : texts[0] ?? mainRelPath,
    )
  }, [projectFiles, mainRelPath])

  useEffect(() => {
    return () => {
      compilerRef.current?.terminate()
      compilerRef.current = null
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [])

  const markDirty = (path: string, text: string) => {
    buffersRef.current.set(path, text)
    setDirty((d) => (d.has(path) ? d : new Set(d).add(path)))
  }

  const compile = async () => {
    setCompiling(true)
    setLog("")
    setStatus("Loading engine & compiling…")
    try {
      if (!compilerRef.current) {
        compilerRef.current = new LatexCompiler({
          onLog: (line) => setLog((l) => `${l}${line}\n`),
        })
      }
      const files: LatexFile[] = []
      for (const [path, text] of buffersRef.current) {
        files.push({ path, contents: text })
      }
      for (const [path, bytes] of binariesRef.current) {
        files.push({ path, contents: bytes })
      }
      const result = await compilerRef.current.compile(files, mainRelPath)
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
      for (const rel of dirty) {
        const text = buffersRef.current.get(rel) ?? ""
        const repoPath = baseDir ? `${baseDir}/${rel}` : rel
        const file = new File([text], rel.split("/").pop() || rel, {
          type: "text/plain",
        })
        await ProjectsService.putProjectContents({
          ownerName,
          projectName,
          path: repoPath,
          contentLength: file.size,
          formData: { file },
        })
      }
    },
    onSuccess: () => {
      setDirty(new Set())
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
    if (dirty.size > 0 && !window.confirm("Discard unsaved changes?")) {
      return
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="full">
      <ModalOverlay />
      <ModalContent>
        <Flex align="center" gap={3} px={4} py={2} borderBottomWidth="1px">
          <Text fontWeight="bold">{activePath || mainRelPath}</Text>
          {dirty.size > 0 && (
            <Badge colorScheme="orange" variant="subtle">
              {dirty.size} unsaved
            </Badge>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={compile}
            isLoading={compiling}
            isDisabled={isLoading}
          >
            Compile preview
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
            isDisabled={dirty.size === 0}
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
          {isLoading ? (
            <Flex height="calc(100vh - 49px)" align="center" justify="center">
              <Spinner />
            </Flex>
          ) : (
            <Flex height="calc(100vh - 49px)">
              <Box
                width="220px"
                borderRightWidth="1px"
                overflowY="auto"
                p={2}
                flexShrink={0}
              >
                <Text fontSize="xs" color="ui.dim" mb={1} px={1}>
                  Files
                </Text>
                <VStack align="stretch" spacing={0}>
                  {textPaths.map((p) => (
                    <Button
                      key={p}
                      size="xs"
                      variant={p === activePath ? "solid" : "ghost"}
                      justifyContent="flex-start"
                      fontWeight={p === mainRelPath ? "bold" : "normal"}
                      onClick={() => setActivePath(p)}
                    >
                      {dirty.has(p) ? "• " : ""}
                      {p}
                    </Button>
                  ))}
                  {[...binariesRef.current.keys()].sort().map((p) => (
                    <Text
                      key={p}
                      fontSize="xs"
                      color="ui.dim"
                      px={3}
                      py={1}
                      isTruncated
                    >
                      {p}
                    </Text>
                  ))}
                </VStack>
              </Box>
              <Box flex="1" borderRightWidth="1px" minW={0}>
                <EditorPane
                  key={activePath}
                  initialDoc={buffersRef.current.get(activePath) ?? ""}
                  viewRef={viewRef}
                  onChange={(text) => markDirty(activePath, text)}
                />
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
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default LatexEditor
