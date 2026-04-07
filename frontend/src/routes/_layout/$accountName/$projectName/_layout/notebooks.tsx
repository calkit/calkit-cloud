import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import {
  Text,
  Flex,
  Box,
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
import { useNavigate } from "@tanstack/react-router"
import { SiJupyter } from "react-icons/si"
import { FaCodeBranch } from "react-icons/fa"
import { z } from "zod"

import { IpynbRenderer } from "react-ipynb-renderer"
import "react-ipynb-renderer/dist/styles/monokai.css"

import { ProjectsService, type Notebook } from "../../../../../client"
import PageMenu from "../../../../../components/Common/PageMenu"
import { ArtifactCompareModal } from "../../../../../components/Common/ArtifactCompareModal"

const notebookSearchSchema = z.object({
  ref: z.string().optional(),
  path: z.string().optional(),
  compare_ref: z.string().optional(),
  compare_ref2: z.string().optional(),
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
            ".ipynb-renderer-root #notebook-container": {
              width: "100%",
              marginLeft: 0,
              marginRight: 0,
            },
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
  onOpenCompare,
}: {
  notebook: Notebook
  onOpenCompare: () => void
}) {
  const bg = useColorModeValue("ui.secondary", "ui.darkSlate")

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
      <Button mt={2} size="sm" onClick={onOpenCompare}>
        <Icon as={FaCodeBranch} mr={1} />
        Browse history
      </Button>
    </Box>
  )
}

function Notebooks() {
  const { accountName, projectName } = Route.useParams()
  const {
    ref,
    path: selectedPath,
    compare_ref,
    compare_ref2,
  } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setSelectedPath = (p: string) =>
    navigate({ search: (prev) => ({ ...prev, path: p }) })
  const compareModal = useDisclosure({
    defaultIsOpen: Boolean(compare_ref),
  })

  const { isPending, data: notebooks } = useQuery({
    queryKey: ["projects", accountName, projectName, "notebooks", ref],
    queryFn: () =>
      ProjectsService.getProjectNotebooks({
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
        <LoadingSpinner />
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
                    onClick={() => setSelectedPath(nb.path ?? "")}
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
          <Box flex={1} minW={0} mr={6}>
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
                onOpenCompare={compareModal.onOpen}
              />
              <ArtifactCompareModal
                isOpen={compareModal.isOpen}
                onClose={compareModal.onClose}
                ownerName={accountName}
                projectName={projectName}
                path={selectedNotebook.path ?? ""}
                kind="notebook"
                initialRef={compare_ref}
                initialRef2={compare_ref2}
                initialArtifact={selectedNotebook}
              />
            </Box>
          )}
        </Flex>
      )}
    </>
  )
}
