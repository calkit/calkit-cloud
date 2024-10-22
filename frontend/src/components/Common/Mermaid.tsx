import { useEffect } from "react"
import mermaid from "mermaid"
import { zoom, zoomTransform } from "d3-zoom"
import { select } from "d3-selection"
import { Box, useColorModeValue } from "@chakra-ui/react"

interface MermaidProps {
  children: string
}

const Mermaid = ({ children }: MermaidProps) => {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")

  const handleZoom = (svgSelection: any) => {
    const svgNode = svgSelection.node()
    if (svgNode instanceof Element) {
      const transform = zoomTransform(svgNode)
      const gSelection = svgSelection.select("g")
      gSelection.attr("transform", transform.toString())
    }
  }

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          fontFamily: "monospace",
        })
        await mermaid.run({ querySelector: ".mermaid" })
        const svgSelection = select<Element, unknown>(".mermaid svg")
        // Remove max-width set by mermaid-js
        svgSelection.style("max-width", "none")

        svgSelection.call(
          zoom<Element, unknown>().on("zoom", () => {
            handleZoom(svgSelection)
          }),
        )
      } catch (error) {
        console.error("Error rendering Mermaid diagram:", error)
      }
    }
    renderDiagram()
    return () => {
      select(".mermaid svg").on("zoom", null)
    }
  }, [children])

  return (
    <Box
      className="mermaid"
      aria-label="Mermaid diagram"
      role="img"
      borderRadius="lg"
      borderWidth={0}
      aspectRatio={1 / 1}
      bg={secBgColor}
      boxSizing="border-box"
      overflow={"hidden"}
      p={2}
      sx={{
        "& svg": {
          height: "100%",
          width: "100%",
        },
      }}
    >
      {children}
    </Box>
  )
}

export default Mermaid
