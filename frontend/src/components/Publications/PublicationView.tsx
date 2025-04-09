import { Image, Alert, AlertIcon, Box } from "@chakra-ui/react"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
  Tip,
} from "react-pdf-highlighter"
import type {
  Content,
  IHighlight,
  NewHighlight,
  ScaledPosition,
} from "react-pdf-highlighter"
import "react-pdf-highlighter/dist/style.css"

import { type Publication } from "../../client"

interface PubViewProps {
  publication: Publication
}

function PdfView({ publication }: PubViewProps) {
  const getNextId = () => String(Math.random()).slice(2)

  const parseIdFromHash = () =>
    document.location.hash.slice("#highlight-".length)

  const resetHash = () => {
    document.location.hash = ""
  }

  const PRIMARY_PDF_URL = publication.url
    ? publication.url
    : "https://arxiv.org/pdf/1708.08021"
  const SECONDARY_PDF_URL = "https://arxiv.org/pdf/1604.02480"

  const searchParams = new URLSearchParams(document.location.search)
  const initialUrl = searchParams.get("url") || PRIMARY_PDF_URL

  const [url, setUrl] = useState(initialUrl)
  const [highlights, setHighlights] = useState<Array<IHighlight>>([])

  const HighlightPopup = ({
    comment,
  }: {
    comment: { text: string; emoji: string }
  }) =>
    comment.text ? (
      <div className="Highlight__popup">
        {comment.emoji} {comment.text}
      </div>
    ) : null

  const resetHighlights = () => {
    setHighlights([])
  }

  const toggleDocument = () => {
    const newUrl = url === PRIMARY_PDF_URL ? SECONDARY_PDF_URL : PRIMARY_PDF_URL
    setUrl(newUrl)
    setHighlights(testHighlights[newUrl] ? [...testHighlights[newUrl]] : [])
  }

  const scrollViewerTo = useRef((highlight: IHighlight) => {})

  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = getHighlightById(parseIdFromHash())
    if (highlight) {
      scrollViewerTo.current(highlight)
    }
  }, [])

  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash, false)
    return () => {
      window.removeEventListener("hashchange", scrollToHighlightFromHash, false)
    }
  }, [scrollToHighlightFromHash])

  const getHighlightById = (id: string) => {
    return highlights.find((highlight) => highlight.id === id)
  }

  const addHighlight = (highlight: NewHighlight) => {
    console.log("Saving highlight", highlight)
    setHighlights((prevHighlights) => [
      { ...highlight, id: getNextId() },
      ...prevHighlights,
    ])
  }

  const updateHighlight = (
    highlightId: string,
    position: Partial<ScaledPosition>,
    content: Partial<Content>,
  ) => {
    console.log("Updating highlight", highlightId, position, content)
    setHighlights((prevHighlights) =>
      prevHighlights.map((h) => {
        const {
          id,
          position: originalPosition,
          content: originalContent,
          ...rest
        } = h
        return id === highlightId
          ? {
              id,
              position: { ...originalPosition, ...position },
              content: { ...originalContent, ...content },
              ...rest,
            }
          : h
      }),
    )
  }

  return (
    <Box position={"relative"} height={"100%"}>
      <PdfLoader url={url} beforeLoad={<div>Loading...</div>}>
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            enableAreaSelection={(event) => event.altKey}
            onScrollChange={resetHash}
            scrollRef={(scrollTo) => {
              scrollViewerTo.current = scrollTo
              scrollToHighlightFromHash()
            }}
            onSelectionFinished={(
              position,
              content,
              hideTipAndSelection,
              transformSelection,
            ) => (
              <Tip
                onOpen={transformSelection}
                onConfirm={(comment) => {
                  addHighlight({ content, position, comment })
                  hideTipAndSelection()
                }}
              />
            )}
            highlightTransform={(
              highlight,
              index,
              setTip,
              hideTip,
              viewportToScaled,
              screenshot,
              isScrolledTo,
            ) => {
              const isTextHighlight = !highlight.content?.image

              const component = isTextHighlight ? (
                <Highlight
                  isScrolledTo={isScrolledTo}
                  position={highlight.position}
                  comment={highlight.comment}
                />
              ) : (
                <AreaHighlight
                  isScrolledTo={isScrolledTo}
                  highlight={highlight}
                  onChange={(boundingRect) => {
                    updateHighlight(
                      highlight.id,
                      { boundingRect: viewportToScaled(boundingRect) },
                      { image: screenshot(boundingRect) },
                    )
                  }}
                />
              )

              return (
                <Popup
                  popupContent={<HighlightPopup {...highlight} />}
                  onMouseOver={(popupContent) =>
                    setTip(highlight, (highlight) => popupContent)
                  }
                  onMouseOut={hideTip}
                  key={index}
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

function PublicationView({ publication }: PubViewProps) {
  let contentView = <>Not set</>
  if (
    publication.path.endsWith(".pdf") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <PdfView publication={publication} />
      // <embed
      //   height="100%"
      //   width="100%"
      //   type="application/pdf"
      //   src={
      //     publication.content
      //       ? `data:application/pdf;base64,${publication.content}`
      //       : String(publication.url)
      //   }
      // />
    )
  } else if (
    publication.path.endsWith(".html") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <embed
        height="100%"
        width="100%"
        type="text/html"
        src={
          publication.url
            ? String(publication.url)
            : `data:text/html;base64,${publication.content}`
        }
      />
    )
  } else if (
    publication.path.endsWith(".png") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <Image
        alt={publication.title}
        src={
          publication.content
            ? `data:image/png;base64,${publication.content}`
            : String(publication.url)
        }
      />
    )
  } else {
    contentView = (
      <Alert mt={2} status="warning" borderRadius="xl">
        <AlertIcon />
        Cannot render content, either because it is empty or an unrecognized
        file type.
      </Alert>
    )
  }
  return <>{contentView}</>
}

export default PublicationView
