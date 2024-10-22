import { useEffect } from "react"
import mermaid from "mermaid"
import { zoom, zoomTransform } from "d3-zoom"
import { select } from "d3-selection"
import { Box, Flex, IconButton, useColorModeValue } from "@chakra-ui/react"
import { FaHome } from "react-icons/fa"

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
      borderRadius="lg"
      borderWidth={0}
      aspectRatio={1 / 1}
      bg={secBgColor}
      boxSizing="border-box"
      overflow={"hidden"}
      px={3}
      py={2}
      position={"relative"}
    >
      <Box position="relative">
        <IconButton
          aria-label="refresh"
          height="25px"
          icon={<FaHome />}
          onClick={() => console.log("Go home")}
          position={"absolute"}
          right={0}
        />
      </Box>
      <Box
        className="mermaid"
        aria-label="Mermaid diagram"
        role="img"
        h={"100%"}
        w={"100%"}
        sx={{
          "& svg": {
            height: "100%",
            width: "100%",
          },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Mermaid
