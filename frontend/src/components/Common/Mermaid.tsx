import { useEffect, useRef } from "react"
import mermaid from "mermaid"
import { zoom, zoomIdentity, ZoomBehavior, D3ZoomEvent } from "d3-zoom"
import { select } from "d3-selection"
import { Box, IconButton, Flex } from "@/chakra"
import { FaHome, FaExpandAlt } from "react-icons/fa"

interface MermaidProps {
  children: string
  isDiagramExpanded: boolean
  setIsDiagramExpanded: Function
}

const Mermaid = ({
  children,
  isDiagramExpanded,
  setIsDiagramExpanded,
}: MermaidProps) => {
  const zoomBehaviorRef = useRef<ZoomBehavior<Element, unknown> | null>(null)

  const handleResetZoom = () => {
    const svgSelection = select<Element, unknown>(".mermaid svg")
    if (zoomBehaviorRef.current != null) {
      svgSelection.call(zoomBehaviorRef.current.transform, zoomIdentity)
    }
  }

  const toggleisDiagramExpanded = () => {
    setIsDiagramExpanded(!isDiagramExpanded)
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

        const zoomBehavior = zoom<Element, unknown>().on(
          "zoom",
          (event: D3ZoomEvent<Element, unknown>) => {
            const transform = event.transform
            const gSelection = svgSelection.select("g")
            gSelection.attr("transform", transform.toString())
          },
        )

        svgSelection.call(zoomBehavior)
        zoomBehaviorRef.current = zoomBehavior
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
      borderWidth={1}
      aspectRatio={isDiagramExpanded ? 2 / 1 : 1 / 1}
      boxSizing="border-box"
      overflow={"hidden"}
      px={3}
      py={2}
      position={"relative"}
    >
      <Flex position="relative" direction={"row-reverse"} h={0}>
        <IconButton
          aria-label="expand"
          height="25px"
          icon={<FaExpandAlt />}
          onClick={toggleisDiagramExpanded}
          ml={1}
        />
        <IconButton
          aria-label="refresh"
          height="25px"
          icon={<FaHome />}
          onClick={handleResetZoom}
          mr={1}
        />
      </Flex>
      <Box
        className="mermaid"
        aria-label="Mermaid diagram"
        role="img"
        h={"100%"}
        w={"100%"}
        css={{
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
