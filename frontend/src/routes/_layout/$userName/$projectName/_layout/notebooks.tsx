import {
  Text,
  Flex,
  Box,
  Spinner,
  useColorModeValue,
  Heading,
  Link,
  Icon,
  Tooltip,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { SiJupyter } from "react-icons/si"
import { IpynbRenderer } from "react-ipynb-renderer"
import axios from "axios"

import { ProjectsService, type Notebook } from "../../../../../client"
import PageMenu from "../../../../../components/Common/PageMenu"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/notebooks",
)({
  component: Notebooks,
})

interface NotebookContentProps {
  notebook: Notebook
}

function NotebookContent({ notebook }: NotebookContentProps) {
  const { userName, projectName } = Route.useParams()
  const { data, isPending } = useQuery({
    queryFn: () => axios.get(String(notebook.url)),
    queryKey: [
      "projects",
      userName,
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
          <Box height="80vh" width="1000px">
            <iframe
              width="100%"
              height="100%"
              title="notebook"
              srcDoc={data}
              style={{ borderRadius: "10px" }}
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
        <Box height="80vh" width="1000px">
          <embed
            height="100%"
            width="100%"
            title="notebook"
            type="text/html"
            style={{ borderRadius: "10px" }}
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
  const { userName, projectName } = Route.useParams()
  const [selectedTitle, setSelectedTitle] = useState<string>()
  const {
    isPending,
    error,
    data: allNotebooks,
  } = useQuery({
    queryKey: ["projects", userName, projectName, "notebooks"],
    queryFn: () =>
      ProjectsService.getProjectNotebooks({
        ownerName: userName,
        projectName: projectName,
      }),
  })
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
                  {allNotebooks?.map((notebook) => (
                    <>
                      {notebook.title === selectedTitle &&
                      (notebook.url || notebook.content) ? (
                        <NotebookContent
                          key={notebook.path}
                          notebook={notebook}
                        />
                      ) : (
                        ""
                      )}
                    </>
                  ))}
                </Box>
              </Flex>
            </>
          )}
        </>
      )}
    </>
  )
}
