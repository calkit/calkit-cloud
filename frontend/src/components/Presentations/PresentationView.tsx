import { Alert, AlertIcon, Box, Center, Image, Spinner } from "@chakra-ui/react"
import { init as initPptxPreview } from "pptx-preview"
import { useEffect, useRef, useState } from "react"

import type { Presentation } from "../../client"

interface PresentationViewProps {
  presentation: Presentation
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function PptxView({ presentation }: PresentationViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const el = wrapperRef.current
    if (!el) return
    // Clear any previously rendered slides (e.g. when switching presentations)
    el.innerHTML = ""
    setIsLoading(true)
    setError(null)

    const render = async () => {
      try {
        let data: ArrayBuffer
        if (presentation.content) {
          data = base64ToArrayBuffer(presentation.content)
        } else if (presentation.url) {
          const resp = await fetch(String(presentation.url))
          if (!resp.ok) {
            throw new Error(`Failed to fetch presentation (${resp.status})`)
          }
          data = await resp.arrayBuffer()
        } else {
          throw new Error("no-content")
        }
        if (cancelled || !wrapperRef.current) return
        const width = wrapperRef.current.clientWidth || 960
        const previewer = initPptxPreview(wrapperRef.current, {
          width,
          height: Math.round((width * 9) / 16),
        })
        previewer.preview(data)
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error && e.message === "no-content"
              ? "no-content"
              : "render-failed",
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    render()
    return () => {
      cancelled = true
    }
  }, [presentation.content, presentation.url])

  if (error === "no-content") {
    return (
      <Alert mt={2} status="warning" borderRadius="xl">
        <AlertIcon />
        No content found. Perhaps the presentation hasn't been built and pushed
        yet?
      </Alert>
    )
  }

  return (
    <Box position="relative" height="100%" overflow="auto">
      {isLoading && (
        <Center position="absolute" inset={0} zIndex={1}>
          <Spinner />
        </Center>
      )}
      {error === "render-failed" && (
        <Alert mt={2} status="error" borderRadius="xl">
          <AlertIcon />
          Could not render this presentation. Try downloading the file instead.
        </Alert>
      )}
      <Box ref={wrapperRef} display="flex" justifyContent="center" />
    </Box>
  )
}

function PresentationView({ presentation }: PresentationViewProps) {
  const path = presentation.path.toLowerCase()
  const hasContent = Boolean(presentation.content || presentation.url)

  if (path.endsWith(".pptx") || path.endsWith(".ppt")) {
    return <PptxView presentation={presentation} />
  }
  if (path.endsWith(".pdf") && hasContent) {
    return (
      <embed
        height="100%"
        width="100%"
        type="application/pdf"
        src={
          presentation.content
            ? `data:application/pdf;base64,${presentation.content}`
            : String(presentation.url)
        }
      />
    )
  }
  if (path.endsWith(".html") && hasContent) {
    return (
      <embed
        height="100%"
        width="100%"
        type="text/html"
        src={
          presentation.url
            ? String(presentation.url)
            : `data:text/html;base64,${presentation.content}`
        }
      />
    )
  }
  if (
    (path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg")) &&
    hasContent
  ) {
    return (
      <Image
        alt={presentation.title}
        src={
          presentation.content
            ? `data:image;base64,${presentation.content}`
            : String(presentation.url)
        }
      />
    )
  }
  return (
    <Alert mt={2} status="warning" borderRadius="xl">
      <AlertIcon />
      No preview available for this presentation
      {presentation.url ? "; use the download link in the info panel." : "."}
    </Alert>
  )
}

export default PresentationView
