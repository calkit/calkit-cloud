import { useEffect } from "react"
import mermaid from "mermaid"
import { zoom, zoomTransform } from "d3-zoom"
import { select } from "d3-selection"

interface MermaidProps {
  children: string
}

const Mermaid = ({ children }: MermaidProps) => {
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
    <div className="mermaid" aria-label="Mermaid diagram" role="img">
      {children}
    </div>
  )
}

export default Mermaid
