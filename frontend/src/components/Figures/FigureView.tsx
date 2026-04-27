import { Box, Image, Text } from "@chakra-ui/react"
import { lazy, Suspense } from "react"
import axios from "axios"

const Plot = lazy(() => import("react-plotly.js"))
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"

import { type Figure } from "../../client"
import PdfCanvas from "../Common/PdfCanvas"

interface FigureViewProps {
  figure: Figure
  width?: string
}

function FigureView({ figure, width }: FigureViewProps) {
  const routeApi = getRouteApi("/_layout/$accountName/$projectName")
  const { accountName, projectName } = routeApi.useParams()
  const boxWidth = width ? width : "100%"
  // Hooks must run in the same order on every render, so fetch HTML-figure
  // content unconditionally and gate it with `enabled`; otherwise paging
  // between a non-HTML and an HTML figure changes the hook count and
  // triggers React error #310.
  const lowerPath = figure.path.toLowerCase()
  const isHtml = lowerPath.endsWith(".html")
  const { data: htmlData, isPending: htmlIsPending } = useQuery({
    queryFn: () => axios.get(String(figure.url)),
    queryKey: [
      "projects",
      accountName,
      projectName,
      "figure-content",
      figure.path,
      figure.url,
    ],
    enabled: isHtml && Boolean(!figure.content && figure.url),
  })
  let figView = <>Not set</>
  if (lowerPath.endsWith(".pdf")) {
    figView = (
      <PdfCanvas
        src={
          figure.content
            ? `data:application/pdf;base64,${figure.content}`
            : String(figure.url)
        }
        width={boxWidth}
      />
    )
  } else if (
    lowerPath.endsWith(".png") ||
    lowerPath.endsWith(".jpg") ||
    lowerPath.endsWith(".jpeg")
  ) {
    const mime = lowerPath.endsWith(".png") ? "image/png" : "image/jpeg"
    figView = (
      <Box width="100%" height="100%">
        <Image
          alt={figure.title}
          src={
            figure.content
              ? `data:${mime};base64,${figure.content}`
              : String(figure.url)
          }
          width="100%"
          height="100%"
          objectFit="contain"
          display="block"
        />
      </Box>
    )
  } else if (lowerPath.endsWith(".svg")) {
    figView = (
      <Box width="100%" height="100%">
        <Image
          alt={figure.title}
          src={
            figure.content
              ? `data:image/svg+xml;base64,${figure.content}`
              : String(figure.url)
          }
          width="100%"
          height="100%"
          objectFit="contain"
          display="block"
        />
      </Box>
    )
  } else if (lowerPath.endsWith(".json")) {
    try {
      const figObject = JSON.parse(atob(String(figure.content)))
      if (figObject.data && figObject.layout) {
        figView = (
          <Box width={boxWidth}>
            <Suspense fallback={<Text>Loading...</Text>}>
              <Plot
                data={figObject.data}
                layout={figObject.layout}
                config={{ displayModeBar: false }}
                style={{ width: "100%", height: "100%" }}
                useResizeHandler={true}
              />
            </Suspense>
          </Box>
        )
      } else {
        figView = <Text>Cannot render this type of figure</Text>
      }
    } catch {
      figView = <Text>Cannot render this type of figure</Text>
    }
  } else if (isHtml) {
    let figContent = figure.content
    if (!figure.content && figure.url) {
      figContent = htmlData?.data
    } else {
      figContent = "No content found"
    }
    figView = (
      <Box width={boxWidth} height="400px">
        {figContent ? (
          <iframe
            width="100%"
            height="100%"
            title="figure"
            srcDoc={figContent}
          />
        ) : htmlIsPending ? (
          "Loading..."
        ) : (
          ""
        )}
      </Box>
    )
  } else {
    figView = <Text>Cannot render this type of figure</Text>
  }
  return figView
}

export default FigureView
