import { useEffect } from "react"
import mermaid from "mermaid"
import { zoom, zoomTransform } from "d3-zoom"
import { select } from "d3-selection"

interface MermaidProps {
  children: string
}

const Mermaid = ({ children }: MermaidProps) => {
  const handleZoom = () => {
    const transform = zoomTransform(select(".mermaid svg").node())
    select(".mermaid svg g").attr("transform", transform)
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
      select(".mermaid svg").call(
        zoom().on("zoom", () => {
          handleZoom()
        }),
      )
    }
    renderDiagram()
  }, [])
  return <div className="mermaid">{children}</div>
}

export default Mermaid
