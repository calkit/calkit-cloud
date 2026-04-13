import { Box, Image, Text } from "@chakra-ui/react"
import Plot from "react-plotly.js"
import axios from "axios"
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
  let figView = <>Not set</>
  if (figure.path.endsWith(".pdf")) {
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
    figure.path.endsWith(".png") ||
    figure.path.endsWith(".jpg") ||
    figure.path.endsWith(".jpeg")
  ) {
    const mime = figure.path.endsWith(".png") ? "image/png" : "image/jpeg"
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
  } else if (figure.path.endsWith(".svg")) {
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
  } else if (figure.path.endsWith(".json")) {
    try {
      const figObject = JSON.parse(atob(String(figure.content)))
      if (figObject.data && figObject.layout) {
        figView = (
          <Box width={boxWidth}>
            <Plot
              data={figObject.data}
              layout={figObject.layout}
              config={{ displayModeBar: false }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler={true}
            />
          </Box>
        )
      } else {
        figView = <Text>Cannot render this type of figure</Text>
      }
    } catch {
      figView = <Text>Cannot render this type of figure</Text>
    }
  } else if (figure.path.endsWith(".html")) {
    // Embed HTML figure in an iframe
    const { data, isPending } = useQuery({
      queryFn: () => axios.get(String(figure.url)),
      queryKey: [
        "projects",
        accountName,
        projectName,
        "figure-content",
        figure.path,
        figure.url,
      ],
      enabled: Boolean(!figure.content && figure.url),
    })
    let figContent = figure.content
    if (!figure.content && figure.url) {
      figContent = data?.data
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
        ) : isPending ? (
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
