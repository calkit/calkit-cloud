import { Box, Image } from "@chakra-ui/react"
import SyntaxHighlighter from "react-syntax-highlighter"
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs"

import Markdown from "../Common/Markdown"
import { type ContentsItem } from "../../client"

interface FileContentProps {
  item: ContentsItem
}

function getLanguage(name: string): string {
  if (name.endsWith(".py")) return "python"
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript"
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript"
  if (name.endsWith(".yaml") || name.endsWith(".yml") || name === "dvc.lock")
    return "yaml"
  if (name.endsWith(".json")) return "json"
  if (name.endsWith(".sh") || name.endsWith(".bash")) return "bash"
  if (name.endsWith(".r") || name.endsWith(".R")) return "r"
  if (name.endsWith(".toml")) return "ini"
  if (name === "Dockerfile") return "dockerfile"
  if (name.endsWith(".cpp") || name.endsWith(".cc")) return "cpp"
  if (name.endsWith(".c")) return "c"
  if (name.endsWith(".go")) return "go"
  if (name.endsWith(".java")) return "java"
  if (name.endsWith(".rs")) return "rust"
  if (name.endsWith(".css")) return "css"
  if (name.endsWith(".html")) return "html"
  if (name.endsWith(".tex")) return "latex"
  return "text"
}

function FileContent({ item }: FileContentProps) {
  const { name, content, url } = item
  if (name.endsWith(".png")) {
    return (
      <Image
        src={content ? `data:image/png;base64,${content}` : String(url)}
        width={"100%"}
      />
    )
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return (
      <Image
        src={content ? `data:image/jpeg;base64,${content}` : String(url)}
        width={"100%"}
      />
    )
  }
  if (name.endsWith(".pdf")) {
    return (
      <Box
        height="calc(100vh - 160px)"
        width="100%"
        borderRadius="lg"
        overflow="hidden"
      >
        <embed
          height="100%"
          width="100%"
          type="application/pdf"
          src={content ? `data:application/pdf;base64,${content}` : String(url)}
        />
      </Box>
    )
  }
  if (name.endsWith(".md") && content) {
    return (
      <Box
        height="calc(100vh - 160px)"
        width="100%"
        overflowY="auto"
        py={2}
        px={4}
      >
        <Markdown>{atob(content)}</Markdown>
      </Box>
    )
  }
  return (
    <Box
      borderRadius="lg"
      overflow="hidden"
      height="calc(100vh - 160px)"
      fontSize="sm"
    >
      <SyntaxHighlighter
        language={getLanguage(name)}
        style={atomOneDark}
        customStyle={{
          height: "100%",
          margin: 0,
          borderRadius: "8px",
          overflowX: "auto",
          overflowY: "auto",
        }}
      >
        {content ? String(atob(content)) : ""}
      </SyntaxHighlighter>
    </Box>
  )
}

export default FileContent
