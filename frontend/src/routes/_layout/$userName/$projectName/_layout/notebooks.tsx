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
  })
  const getOutput = (data: any) => {
    if (notebook.output_format === "html") {
      return (
        <>
          <iframe
            width="1000px"
            height="1000px"
            title="notebook"
            srcDoc={data}
          />
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
      {isPending ? (
        <Flex justify="center" align="center" height="full" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <>
          {data?.data ? (
            <Box>{getOutput(data.data)}</Box>
          ) : (
            "Notebook content could not be loaded."
          )}
        </>
      )}
    </>
  )
}

function Notebooks() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
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
              <Flex width="full">
                {/* Notebooks table of contents */}
                <Box>
                  <Box
                    bg={secBgColor}
                    px={4}
                    py={2}
                    borderRadius="lg"
                    mr={8}
                    position={"sticky"}
                    top={50}
                    minH="75px"
                    maxH="80%"
                    overflowY="auto"
                  >
                    <Heading size="md" mb={1}>
                      Notebooks
                    </Heading>
                    {allNotebooks?.map((notebook) => (
                      <Box
                        px={1}
                        py={0.5}
                        borderRadius="lg"
                        key={notebook.path}
                        bg={
                          selectedTitle === notebook.title ? bgActive : "none"
                        }
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
                              <Text>{notebook.path}</Text>
                            </Tooltip>
                          </Flex>
                        </Link>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box>
                  {allNotebooks?.map((notebook) => (
                    <>
                      {notebook.title === selectedTitle && notebook.url ? (
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