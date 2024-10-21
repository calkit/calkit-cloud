import { useEffect } from "react"
import mermaid from "mermaid"
import { zoom, zoomTransform } from "d3-zoom"
import { select } from "d3-selection"

interface MermaidProps {
  children: string
}

const Mermaid = ({ children }: MermaidProps) => {
  const handleZoom = () => {
    const svgNode = select(".mermaid svg").node()
    if (svgNode instanceof Element) {
      const transform = zoomTransform(svgNode as Element)
      select(".mermaid svg g").attr("transform", transform.toString())
    }
  }

  useEffect(() => {
    const renderDiagram = async () => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        fontFamily: "monospace",
      })
      await mermaid.run({ querySelector: ".mermaid" })
      select<Element, unknown>(".mermaid svg").call(
        zoom<Element, unknown>().on("zoom", () => {
          handleZoom()
        }),
      )
    }
    renderDiagram()
  }, [])

  return <div className="mermaid">{children}</div>
}

export default Mermaid
