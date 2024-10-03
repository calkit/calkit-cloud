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
import React from "react"

interface MarkdownProps {
  children: string
}

interface codeProps extends React.HTMLAttributes<HTMLElement> {
  insidePre?: boolean
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

// Send prop to children of <pre> to differentiate if they are block code or not
const pre = ({ children, ...props }: any) => {
  return (
    <pre {...props}>
      {React.Children.map(children, (child) => {
        console.log(`child ${child}`)
        return React.cloneElement(child, { insidePre: true })
      })}
    </pre>
  )
}

const code = ({ insidePre = false, ...props }: codeProps) => {
  if (insidePre) {
    return <Code my={2} whiteSpace={"pre"} display={"block"} p={2} {...props} />
  } else {
    return <Code my={2} whiteSpace={"pre"} px={1} {...props} />
  }
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
        pre: pre,
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
