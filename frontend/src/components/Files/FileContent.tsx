import { Box, Image, Code } from "@chakra-ui/react"

import Markdown from "../Common/Markdown"
import { type ContentsItem } from "../../client"

interface FileContentProps {
  item: ContentsItem
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
      <embed
        height="100%"
        width="100%"
        type="application/pdf"
        src={content ? `data:application/pdf;base64,${content}` : String(url)}
      />
    )
  }
  if (name.endsWith(".md") && content) {
    return (
      <Box py={2} px={4} maxW={"750px"}>
        <Markdown>{atob(content)}</Markdown>
      </Box>
    )
  }
  return (
    <Code
      p={2}
      borderRadius="lg"
      display="block"
      whiteSpace="pre"
      height="82vh"
      overflowY="auto"
      maxW="685px"
      overflowX="auto"
    >
      {content ? String(atob(content)) : ""}
    </Code>
  )
}

export default FileContent
