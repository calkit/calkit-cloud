import {
  Text,
  Flex,
  Box,
  Spinner,
  useColorModeValue,
  Heading,
  Icon,
  Code,
  HStack,
  Button,
  useDisclosure,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { SiJupyter } from "react-icons/si"
import { FaCodeBranch } from "react-icons/fa"
import { z } from "zod"

import { IpynbRenderer } from "react-ipynb-renderer"
import "react-ipynb-renderer/dist/styles/monokai.css"

import { type Notebook } from "../../../../../client"
import PageMenu from "../../../../../components/Common/PageMenu"
import { getProjectNotebooksAtRef } from "../../../../../lib/projectRefApi"
import { ArtifactCompareModal } from "../../../../../components/Common/ArtifactCompareModal"

const notebookSearchSchema = z.object({
  ref: z.string().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/notebooks",
)({
  component: Notebooks,
  validateSearch: (search) => notebookSearchSchema.parse(search),
})

function NotebookView({ notebook }: { notebook: Notebook }) {
  if (notebook.output_format === "notebook" && notebook.content) {
    try {
      const json = JSON.parse(atob(notebook.content))
      return (
        <Box
          overflowY="auto"
          height="100%"
          borderRadius="lg"
          overflow="hidden"
          sx={{
            ".ipynb-renderer-root": { borderRadius: "var(--chakra-radii-lg)" },
            ".ipynb-renderer-root pre, .ipynb-renderer-root .CodeMirror": {
              fontSize: "13px !important",
              lineHeight: "1.5 !important",
            },
          }}
        >
          <IpynbRenderer ipynb={json} syntaxTheme="atomDark" />
        </Box>
      )
    } catch {
      // fall through to other renderers
    }
  }
  if (notebook.output_format === "html" && notebook.content) {
    return (
      <embed
        height="100%"
        width="100%"
        type="text/html"
        src={`data:text/html;base64,${notebook.content}`}
      />
    )
  }
  if (notebook.url) {
    return (
      <iframe
        height="100%"
        width="100%"
        title="notebook"
        src={notebook.url}
        style={{ border: "none" }}
      />
    )
  }
  return (
    <Flex align="center" justify="center" height="300px" color="gray.500">
      <Text>
        No rendered output found. Run the notebook and commit the HTML output to
        view it here.
      </Text>
    </Flex>
  )
}

function NotebookInfo({
  notebook,
  ownerName,
  projectName,
}: {
  notebook: Notebook
  ownerName: string
  projectName: string
}) {
  const bg = useColorModeValue("ui.secondary", "ui.darkSlate")
  const compareModal = useDisclosure()

  return (
    <Box bg={bg} borderRadius="lg" p={3} h="fit-content">
      <Heading size="sm" mb={2}>
        Info
      </Heading>
      <Text fontSize="sm" mb={1}>
        Path: <Code fontSize="xs">{notebook.path}</Code>
      </Text>
      {notebook.stage && (
        <Text fontSize="sm" mb={1}>
          Pipeline stage: <Code fontSize="xs">{notebook.stage}</Code>
        </Text>
      )}
      <Button mt={2} size="sm" onClick={compareModal.onOpen}>
        <Icon as={FaCodeBranch} mr={1} />
        Browse history
      </Button>
      <ArtifactCompareModal
        isOpen={compareModal.isOpen}
        onClose={compareModal.onClose}
        ownerName={ownerName}
        projectName={projectName}
        path={notebook.path}
        kind="notebook"
      />
    </Box>
  )
}

function Notebooks() {
  const { accountName, projectName } = Route.useParams()
  const { ref } = Route.useSearch()
  const [selectedPath, setSelectedPath] = useState<string | undefined>()

  const { isPending, data: notebooks } = useQuery({
    queryKey: ["projects", accountName, projectName, "notebooks", ref],
    queryFn: () =>
      getProjectNotebooksAtRef({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })

  const selectedNotebook =
    notebooks?.find((n) => n.path === selectedPath) ?? notebooks?.[0]

  return (
    <>
      {isPending ? (
        <Flex justify="center" align="center" height="full" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex height="100%" gap={0}>
          {/* Left: list */}
          <PageMenu>
            <Heading size="md" mb={2}>
              Notebooks
            </Heading>
            {!notebooks || notebooks.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                No notebooks found
              </Text>
            ) : (
              notebooks.map((nb) => {
                const isSelected = nb.path === selectedNotebook?.path
                return (
                  <HStack
                    key={nb.path}
                    px={1}
                    py={0.5}
                    borderRadius="md"
                    cursor="pointer"
                    fontWeight={isSelected ? "semibold" : "normal"}
                    _hover={{ color: "blue.500" }}
                    onClick={() => setSelectedPath(nb.path)}
                    spacing={1}
                  >
                    <Icon as={SiJupyter} flexShrink={0} color="orange.400" />
                    <Text fontSize="sm" noOfLines={1}>
                      {nb.title ?? nb.path}
                    </Text>
                  </HStack>
                )
              })
            )}
          </PageMenu>

          {/* Center: viewer */}
          <Box flex={1} minW={0} mx={4}>
            {selectedNotebook ? (
              <>
                <Heading size="md" mb={1}>
                  {selectedNotebook.title ?? selectedNotebook.path}
                </Heading>
                {selectedNotebook.description && (
                  <Text fontSize="sm" color="gray.500" mb={2}>
                    {selectedNotebook.description}
                  </Text>
                )}
                <Box height="80vh" borderRadius="lg" overflow="hidden">
                  <NotebookView notebook={selectedNotebook} />
                </Box>
              </>
            ) : (
              <Flex
                align="center"
                justify="center"
                height="300px"
                color="gray.500"
                direction="column"
                gap={3}
              >
                <Icon as={SiJupyter} fontSize="4xl" color="orange.300" />
                <Text>No notebooks found</Text>
              </Flex>
            )}
          </Box>

          {/* Right: info */}
          {selectedNotebook && (
            <Box w="240px" flexShrink={0}>
              <NotebookInfo
                notebook={selectedNotebook}
                ownerName={accountName}
                projectName={projectName}
              />
            </Box>
          )}
        </Flex>
      )}
    </>
  )
}
