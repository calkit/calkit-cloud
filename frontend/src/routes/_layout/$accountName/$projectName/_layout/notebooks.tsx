import {
  Text,
  Flex,
  Box,
  Spinner,
  useColorModeValue,
  Heading,
  Icon,
  SimpleGrid,
  useDisclosure,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { SiJupyter } from "react-icons/si"
import { z } from "zod"

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

/** Thumbnail card for a notebook in the gallery. */
function NotebookThumbnail({
  notebook,
  onClick,
}: {
  notebook: Notebook
  onClick: () => void
}) {
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const bg = useColorModeValue("white", "gray.800")
  const hoverBg = useColorModeValue("gray.50", "gray.700")

  return (
    <Box
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="lg"
      overflow="hidden"
      bg={bg}
      cursor="pointer"
      _hover={{ bg: hoverBg, shadow: "md" }}
      onClick={onClick}
      transition="all 0.15s"
    >
      <Flex
        height="120px"
        align="center"
        justify="center"
        bg="orange.50"
        color="orange.400"
        fontSize="4xl"
      >
        <Icon as={SiJupyter} />
      </Flex>
      <Box p={3}>
        <Text fontWeight="semibold" fontSize="sm" noOfLines={1}>
          {notebook.title || notebook.path}
        </Text>
        {notebook.description && (
          <Text fontSize="xs" color="gray.500" noOfLines={2} mt={0.5}>
            {notebook.description}
          </Text>
        )}
        <Text fontSize="xs" color="gray.400" mt={0.5} noOfLines={1}>
          {notebook.path}
        </Text>
      </Box>
    </Box>
  )
}

function Notebooks() {
  const { accountName, projectName } = Route.useParams()
  const { ref } = Route.useSearch()
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(
    null,
  )
  const compareModal = useDisclosure()

  const { isPending, error, data: allNotebooks } = useQuery({
    queryKey: ["projects", accountName, projectName, "notebooks", ref],
    queryFn: () =>
      getProjectNotebooksAtRef({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })

  const openNotebook = (notebook: Notebook) => {
    setSelectedNotebook(notebook)
    compareModal.onOpen()
  }

  return (
    <>
      {isPending ? (
        <Flex justify="center" align="center" height="full" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <>
          {error ? (
            <Box>
              <Text>Could not read notebooks</Text>
            </Box>
          ) : (
            <Flex width="full" my={0} py={0}>
              <PageMenu>
                <Heading size="md" mb={2}>
                  Notebooks
                </Heading>
                {allNotebooks?.map((notebook) => (
                  <Box
                    key={notebook.path}
                    px={1}
                    py={0.5}
                    w="fit-content"
                    maxW="100%"
                  >
                    <Text
                      fontSize="sm"
                      cursor="pointer"
                      _hover={{ color: "blue.500" }}
                      noOfLines={1}
                      onClick={() => openNotebook(notebook)}
                    >
                      <Icon mr={1} as={SiJupyter} />
                      {notebook.path}
                    </Text>
                  </Box>
                ))}
              </PageMenu>

              <Box flex={1} p={4} overflowY="auto">
                {!allNotebooks || allNotebooks.length === 0 ? (
                  <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    height="300px"
                    color="gray.500"
                  >
                    <Icon as={SiJupyter} fontSize="4xl" mb={3} />
                    <Text>No notebooks found</Text>
                  </Flex>
                ) : (
                  <SimpleGrid
                    columns={{ base: 2, md: 3, lg: 4 }}
                    spacing={4}
                  >
                    {allNotebooks.map((notebook) => (
                      <NotebookThumbnail
                        key={notebook.path}
                        notebook={notebook}
                        onClick={() => openNotebook(notebook)}
                      />
                    ))}
                  </SimpleGrid>
                )}
              </Box>
            </Flex>
          )}
        </>
      )}

      {selectedNotebook && (
        <ArtifactCompareModal
          isOpen={compareModal.isOpen}
          onClose={() => {
            compareModal.onClose()
            setSelectedNotebook(null)
          }}
          ownerName={accountName}
          projectName={projectName}
          path={selectedNotebook.path}
          kind="notebook"
          initialRef={ref}
        />
      )}
    </>
  )
}
