import {
  Text,
  Flex,
  Box,
  Spinner,
  useColorModeValue,
  Heading,
  Link,
  Icon,
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
  const { data } = useQuery({
    queryFn: () => axios.get(String(notebook.url)),
    queryKey: ["notebooks", notebook.url],
  })
  return (
    <>
      <Heading size="md">{notebook.title}</Heading>
      {data?.data ? (
        <IpynbRenderer ipynb={data?.data} bgTransparent={false} />
      ) : (
        ""
      )}
    </>
  )
}

function Notebooks() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { userName, projectName } = Route.useParams()
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
  const [selectedTitle, setSelectedTitle] = useState<string>()

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
                        p={1}
                        borderRadius="sm"
                        key={notebook.path}
                        bg={
                          selectedTitle === notebook.title
                            ? "black.800"
                            : "none"
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
                            <Text>{notebook.path}</Text>
                          </Flex>
                        </Link>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box maxW={"60%"} overflowX="scroll">
                  {allNotebooks?.map((notebook) => (
                    <>
                      {notebook.title === selectedTitle && notebook.url ? (
                        <NotebookContent
                          key={notebook.path}
                          notebook={notebook}
                        />
                      ) : (
                        "Click a notebook to render"
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
