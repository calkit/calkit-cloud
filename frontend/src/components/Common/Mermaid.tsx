import { useEffect } from "react"
import mermaid from "mermaid"

interface MermaidProps {
  children: string
}

const Mermaid = ({ children }: MermaidProps) => {
  useEffect(() => {
    const renderDiagram = async () => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
        fontFamily: "monospace",
      })
      await mermaid.run({ querySelector: ".mermaid" })
    }
    renderDiagram()
  })
  return <div className="mermaid">{children}</div>
}

export default Mermaid
