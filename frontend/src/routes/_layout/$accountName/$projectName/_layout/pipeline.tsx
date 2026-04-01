import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { Box, Flex, Heading, Alert, AlertIcon, Link } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useState, useMemo, type ReactNode } from "react"
import { Light as SyntaxHighlighter } from "react-syntax-highlighter"
import yaml from "react-syntax-highlighter/dist/esm/languages/hljs/yaml"
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs"
import jsYaml from "js-yaml"
import React from "react"

import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import Mermaid from "../../../../../components/Common/Mermaid"
import { ProjectsService } from "../../../../../client"

SyntaxHighlighter.registerLanguage("yaml", yaml)

// ---------------------------------------------------------------------------
// Extract file paths from YAML (works for both dvc.yaml and calkit.yaml)
// ---------------------------------------------------------------------------
function looksLikePath(s: string): boolean {
  return (
    s.length > 0 &&
    !s.startsWith("http") &&
    !s.startsWith("git@") &&
    !s.includes(" ") &&
    (s.includes("/") || /\.[a-zA-Z0-9]{1,6}$/.test(s))
  )
}

function extractFilePaths(yamlContent: string): Set<string> {
  try {
    const doc = jsYaml.load(yamlContent)
    const paths = new Set<string>()
    function walk(v: unknown) {
      if (typeof v === "string") {
        if (looksLikePath(v)) paths.add(v)
      } else if (Array.isArray(v)) {
        v.forEach(walk)
      } else if (v !== null && typeof v === "object") {
        for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
          if (looksLikePath(k)) paths.add(k)
          walk(child)
        }
      }
    }
    walk(doc)
    return paths
  } catch {
    return new Set()
  }
}

function makeRenderer(paths: Set<string>, filesTo: string) {
  return function ({
    rows,
    stylesheet,
    useInlineStyles,
  }: {
    rows: unknown[]
    stylesheet: Record<string, React.CSSProperties>
    useInlineStyles: boolean
  }) {
    function renderNode(node: unknown, key: string): ReactNode {
      const n = node as {
        type?: string
        value?: string
        tagName?: string
        properties?: { className?: string[]; style?: React.CSSProperties }
        children?: unknown[]
      }

      if (n.type === "text") {
        const val = n.value ?? ""
        if (paths.has(val)) {
          return (
            <RouterLink key={key} to={filesTo} search={{ path: val } as never}>
              <span style={{ textDecoration: "underline" }}>{val}</span>
            </RouterLink>
          )
        }
        return val
      }

      if (n.type === "element" || n.tagName) {
        const children = n.children?.map((child, i) =>
          renderNode(child, `${key}-${i}`),
        )
        let style: React.CSSProperties = {}
        if (useInlineStyles) {
          for (const cls of n.properties?.className ?? []) {
            if (stylesheet[`.${cls}`])
              style = { ...style, ...stylesheet[`.${cls}`] }
            else if (stylesheet[cls]) style = { ...style, ...stylesheet[cls] }
          }
          if (n.properties?.style) style = { ...style, ...n.properties.style }
        }
        return React.createElement(
          n.tagName ?? "span",
          {
            key,
            className: !useInlineStyles
              ? n.properties?.className?.join(" ")
              : undefined,
            style: useInlineStyles
              ? Object.keys(style).length
                ? style
                : undefined
              : undefined,
          },
          ...(children ?? []),
        )
      }

      return null
    }

    return (
      <code>
        {rows.map((row, i) => (
          <React.Fragment key={i}>{renderNode(row, `r${i}`)}</React.Fragment>
        ))}
      </code>
    )
  }
}

// ---------------------------------------------------------------------------
// Linked YAML block
// ---------------------------------------------------------------------------
function LinkedYaml({
  content,
  filesTo,
}: {
  content: string
  filesTo: string
}) {
  const paths = useMemo(() => extractFilePaths(content), [content])
  const renderer = useMemo(() => makeRenderer(paths, filesTo), [paths, filesTo])

  return (
    <Box height="80vh" overflowY="auto" borderRadius="lg">
      <SyntaxHighlighter
        language="yaml"
        style={atomOneDark}
        renderer={renderer}
        useInlineStyles={true}
        customStyle={{
          borderRadius: "var(--chakra-radii-lg)",
          height: "100%",
          margin: 0,
          fontSize: "13px",
        }}
      >
        {content}
      </SyntaxHighlighter>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/pipeline",
)({
  component: ProjectPipeline,
})

function ProjectPipeline() {
  const { accountName, projectName } = Route.useParams()
  const pipelineQuery = useQuery({
    queryKey: [accountName, projectName, "pipeline"],
    queryFn: () =>
      ProjectsService.getProjectPipeline({
        ownerName: accountName,
        projectName: projectName,
      }),
  })
  const [isDiagramExpanded, setIsDiagramExpanded] = useState(false)

  const filesTo = `/${accountName}/${projectName}/files`

  return (
    <>
      {pipelineQuery.isPending ? (
        <LoadingSpinner height="100vh" />
      ) : (
        <Flex flexDir={isDiagramExpanded ? "column" : "row"} gap={4}>
          {pipelineQuery.data ? (
            <>
              <Box flex={1} minW={0}>
                <Mermaid
                  isDiagramExpanded={isDiagramExpanded}
                  setIsDiagramExpanded={setIsDiagramExpanded}
                >
                  {String(pipelineQuery.data.mermaid)}
                </Mermaid>
              </Box>
              <Box flex={1} minW={0}>
                {pipelineQuery.data.calkit_yaml ? (
                  <>
                    <Heading size="md" my={2}>
                      calkit.yaml
                    </Heading>
                    <LinkedYaml
                      content={String(pipelineQuery.data.calkit_yaml)}
                      filesTo={filesTo}
                    />
                  </>
                ) : (
                  <>
                    <Heading size="md" my={2}>
                      dvc.yaml
                    </Heading>
                    <LinkedYaml
                      content={String(pipelineQuery.data.dvc_yaml)}
                      filesTo={filesTo}
                    />
                  </>
                )}
              </Box>
            </>
          ) : (
            <Alert mt={2} status="warning" borderRadius="xl">
              <AlertIcon />A pipeline has not yet been defined for this project.
              To create one, see the{" "}
              <Link
                ml={1}
                isExternal
                variant="blue"
                href="https://docs.calkit.org/pipeline/"
              >
                pipeline documentation
              </Link>
              .
            </Alert>
          )}
        </Flex>
      )}
    </>
  )
}
