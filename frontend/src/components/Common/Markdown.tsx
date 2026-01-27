import {
  Heading,
  ListItem,
  OrderedList,
  UnorderedList,
  Text,
  Code,
  Link,
} from "@/chakra"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import React from "react"
import { Box } from "@/chakra"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"

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
  return <Heading size="md" mb={2} mt={3} {...props} />
}
const H3 = (props: any) => {
  return <Heading size="sm" my={2} {...props} />
}
const p = (props: any) => {
  return <Text my={2} mt={3} {...props} />
}
const BlueLink = (props: any) => {
  return <Link variant="blue" {...props} />
}

// Send prop to children of <pre> to differentiate if they are block code or not
const pre = ({ children, ...props }: any) => {
  return (
    <pre {...props}>
      {React.Children.map(children, (child) => {
        return React.cloneElement(child, { insidePre: true })
      })}
    </pre>
  )
}

const code = ({ insidePre = false, ...props }: codeProps) => {
  if (insidePre) {
    return <Code my={2} whiteSpace={"pre"} display={"block"} p={2} {...props} />
  } else {
    return <Code my={0} whiteSpace={"pre"} px={1} {...props} />
  }
}

const Markdown = ({ children }: MarkdownProps) => {
  return (
    <Box
      /*
       * Chakra's CSS reset sets img { display: block }, which makes README badges
       * stack vertically. Override within markdown so images (and linked images)
       * behave inline like on GitHub.
       */
      css={{
        "& p img": {
          display: "inline",
          verticalAlign: "middle",
          marginRight: "0.375rem",
        },
        "& p a img": {
          display: "inline",
          verticalAlign: "middle",
          marginRight: "0.375rem",
        },
        // Avoid extra right margin on the last image in a paragraph
        "& p img:last-child, & p a:last-child img": {
          marginRight: 0,
        },
      }}
    >
      <ReactMarkdown
        components={{
          h1: H1,
          h2: H2,
          h3: H3,
          li: ListItem as any,
          ol: OrderedList as any,
          ul: UnorderedList as any,
          p: p,
          pre: pre,
          code: code,
          a: BlueLink,
        }}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
      >
        {children}
      </ReactMarkdown>
    </Box>
  )
}

export default Markdown
