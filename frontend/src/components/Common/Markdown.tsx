import {
  Heading,
  ListItem,
  OrderedList,
  UnorderedList,
  Text,
  Code,
  Link,
} from "@chakra-ui/react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownProps {
  children: string
}

const H1 = (props: any) => {
  return <Heading size="lg" mb={4} {...props} />
}
const H2 = (props: any) => {
  return <Heading size="md" my={2} {...props} />
}
const H3 = (props: any) => {
  return <Heading size="sm" my={2} {...props} />
}
const p = (props: any) => {
  return <Text my={2} mt={3} {...props} />
}
const code = (props: any) => {
  return <Code my={2} whiteSpace={"pre"} px={1} {...props} />
}

const Markdown = ({ children }: MarkdownProps) => {
  return (
    <ReactMarkdown
      components={{
        h1: H1,
        h2: H2,
        h3: H3,
        li: ListItem,
        ol: OrderedList,
        ul: UnorderedList,
        p: p,
        code: code,
        a: Link,
      }}
      remarkPlugins={[remarkGfm]}
    >
      {children}
    </ReactMarkdown>
  )
}

export default Markdown
