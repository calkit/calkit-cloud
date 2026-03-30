import {
  Text,
  Flex,
  Box,
  Button,
  Spinner,
  useColorModeValue,
  Heading,
  Link,
  Icon,
  Tooltip,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { SiJupyter } from "react-icons/si"
import { IpynbRenderer } from "react-ipynb-renderer"
import axios from "axios"
import { z } from "zod"

import { type Notebook } from "../../../../../client"
import PageMenu from "../../../../../components/Common/PageMenu"
import { getProjectNotebooksAtRef } from "../../../../../lib/projectRefApi"
import { RefPicker } from "../../../../../components/Common/RefPicker"

const notebookSearchSchema = z.object({
  ref: z.string().optional(),
  compareRef: z.string().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/notebooks",
)({
  component: Notebooks,
  validateSearch: (search) => notebookSearchSchema.parse(search),
})

interface NotebookContentProps {
  notebook: Notebook
}

function NotebookContent({ notebook }: NotebookContentProps) {
  const borderRadius = "5px"
  const height = "81vh"
  const width = "1000px"
  const { accountName, projectName } = Route.useParams()
  const { data, isPending } = useQuery({
    queryFn: () => axios.get(String(notebook.url)),
    queryKey: [
      "projects",
      accountName,
      projectName,
      "notebook-content",
      notebook.path,
    ],
    enabled: Boolean(notebook.url),
  })
  const getOutput = (data: any) => {
    if (notebook.output_format === "html" && notebook.url) {
      return (
        <>
          <Box height={height} width={width}>
            <iframe
              width="100%"
              height="100%"
              title="notebook"
              srcDoc={data}
              style={{ borderRadius }}
            />
          </Box>
        </>
      )
    }
    if (notebook.output_format === "notebook") {
      return <IpynbRenderer ipynb={data} />
    }
    return "Cannot render notebook output"
  }
  return (
    <>
      {/* If we have content, just show that instead of downloading */}
      {notebook.content && notebook.output_format === "html" ? (
        <Box height={height} width={width}>
          <embed
            height="100%"
            width="100%"
            title="notebook"
            type="text/html"
            style={{ borderRadius }}
            src={`data:text/html;base64,${notebook.content}`}
          />
        </Box>
      ) : (
        ""
      )}
      {/* If we have a URL, fetch and cache it */}
      {notebook.url && isPending ? (
        <Flex justify="center" align="center" height="full" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : notebook.url ? (
        <>
          {data?.data ? (
            <Box>{getOutput(data.data)}</Box>
          ) : (
            "Notebook content could not be loaded."
          )}
        </>
      ) : (
        ""
      )}
    </>
  )
}

function Notebooks() {
  const bgActive = useColorModeValue("#E2E8F0", "#4A5568")
  const { accountName, projectName } = Route.useParams()
  const { ref, compareRef } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [selectedTitle, setSelectedTitle] = useState<string>()
  const [refInput, setRefInput] = useState(ref ?? "")
  const [compareRefInput, setCompareRefInput] = useState(compareRef ?? "")
  const {
    isPending,
    error,
    data: allNotebooks,
  } = useQuery({
    queryKey: ["projects", accountName, projectName, "notebooks", ref],
    queryFn: () =>
      getProjectNotebooksAtRef({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })
  const compareNotebooksQuery = useQuery({
    queryKey: [
      "projects",
      accountName,
      projectName,
      "notebooks",
      compareRef,
      "compare",
    ],
    queryFn: () =>
      getProjectNotebooksAtRef({
        ownerName: accountName,
        projectName: projectName,
        ref: compareRef,
      }),
    enabled: Boolean(compareRef),
    retry: false,
  })

  const applyRefs = () => {
    navigate({
      search: {
        ref: refInput || undefined,
        compareRef: compareRefInput || undefined,
      },
    })
  }

  const clearRefs = () => {
    setRefInput("")
    setCompareRefInput("")
    navigate({
      search: {
        ref: undefined,
        compareRef: undefined,
      },
    })
  }

  const selectedNotebook = allNotebooks?.find((n) => n.title === selectedTitle)
  const compareNotebook = compareNotebooksQuery.data?.find(
    (n) => n.path === selectedNotebook?.path,
  )

  if (allNotebooks && !selectedTitle && allNotebooks[0]) {
    setSelectedTitle(allNotebooks[0].title)
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
            <>
              <Flex width="full" my={0} py={0}>
                {/* Notebooks table of contents */}
                <PageMenu>
                  <Box mb={2}>
                    <Text fontSize="xs" mb={1}>
                      Git refs
                    </Text>
                    <RefPicker
                      ownerName={accountName}
                      projectName={projectName}
                      value={refInput}
                      onChange={setRefInput}
                      placeholder="Primary ref (main, v1.2.0, ...)"
                    />
                    <Box mt={2} />
                    <RefPicker
                      ownerName={accountName}
                      projectName={projectName}
                      value={compareRefInput}
                      onChange={setCompareRefInput}
                      placeholder="Compare ref (optional)"
                    />
                    <Flex gap={1} mt={2}>
                      <Button size="xs" onClick={applyRefs}>
                        Apply
                      </Button>
                      <Button size="xs" variant="ghost" onClick={clearRefs}>
                        Clear
                      </Button>
                    </Flex>
                  </Box>
                  <Heading size="md" mb={1}>
                    Notebooks
                  </Heading>
                  {allNotebooks?.map((notebook) => (
                    <Box
                      px={1}
                      py={0.5}
                      w="fit-content"
                      maxW="100%"
                      borderRadius="lg"
                      key={notebook.path}
                      bg={selectedTitle === notebook.title ? bgActive : "none"}
                    >
                      <Link
                        id={notebook.title}
                        onClick={() => {
                          setSelectedTitle(notebook.title)
                        }}
                      >
                        <Flex alignItems="center">
                          <Icon mr={1} as={SiJupyter} />
                          <Tooltip
                            label={`${notebook.title}: ${notebook.description}`}
                            openDelay={600}
                          >
                            <Text
                              isTruncated
                              noOfLines={1}
                              whiteSpace="nowrap"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              display="inline-block"
                              maxW="100%"
                            >
                              {notebook.path}
                            </Text>
                          </Tooltip>
                        </Flex>
                      </Link>
                    </Box>
                  ))}
                </PageMenu>
                <Box>
                  {selectedNotebook ? (
                    <Flex gap={4} alignItems="flex-start">
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={1}>
                          {ref || "default"}
                        </Text>
                        <NotebookContent notebook={selectedNotebook} />
                      </Box>
                      {compareRef ? (
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" mb={1}>
                            {compareRef}
                          </Text>
                          {compareNotebooksQuery.isPending ? (
                            <Spinner size="md" color="ui.main" />
                          ) : compareNotebook ? (
                            <NotebookContent notebook={compareNotebook} />
                          ) : (
                            <Text>Notebook not found at compare ref.</Text>
                          )}
                        </Box>
                      ) : (
                        ""
                      )}
                    </Flex>
                  ) : (
                    ""
                  )}
                </Box>
              </Flex>
            </>
          )}
        </>
      )}
    </>
  )
}
