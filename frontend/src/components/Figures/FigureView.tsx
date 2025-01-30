import { Box, Image, Text } from "@chakra-ui/react"
import Plot from "react-plotly.js"
import axios from "axios"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"

import { type Figure } from "../../client"

interface FigureViewProps {
  figure: Figure
  width?: string
}

function FigureView({ figure, width }: FigureViewProps) {
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
  const boxWidth = width ? width : "100%"
  let figView = <>Not set</>
  if (figure.path.endsWith(".pdf")) {
    figView = (
      <Box height="530px" width={boxWidth}>
        <embed
          height="100%"
          width="100%"
          type="application/pdf"
          src={
            figure.content
              ? `data:application/pdf;base64,${figure.content}`
              : String(figure.url)
          }
        />
      </Box>
    )
  } else if (
    figure.path.endsWith(".png") ||
    figure.path.endsWith(".jpg") ||
    figure.path.endsWith(".jpeg")
  ) {
    figView = (
      <Box width={boxWidth}>
        <Image
          alt={figure.title}
          src={
            figure.content
              ? `data:image/png;base64,${figure.content}`
              : String(figure.url)
          }
        />
      </Box>
    )
  } else if (figure.path.endsWith(".svg")) {
    figView = (
      <Box width={boxWidth}>
        <Image
          alt={figure.title}
          src={
            figure.content
              ? `data:image/svg+xml;base64,${figure.content}`
              : String(figure.url)
          }
          width="100%"
        />
      </Box>
    )
  } else if (figure.path.endsWith(".json")) {
    const figObject = JSON.parse(atob(String(figure.content)))
    const layout = figObject.layout
    figView = (
      <Box width={boxWidth}>
        <Plot
          data={figObject.data}
          layout={layout}
          config={{ displayModeBar: false }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler={true}
        />
      </Box>
    )
  } else if (figure.path.endsWith(".html")) {
    // Embed HTML figure in an iframe
    const { data, isPending } = useQuery({
      queryFn: () => axios.get(String(figure.url)),
      queryKey: [
        "projects",
        userName,
        projectName,
        "figure-content",
        figure.path,
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
