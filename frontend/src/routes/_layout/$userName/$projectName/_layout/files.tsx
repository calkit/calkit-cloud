import { createFileRoute } from "@tanstack/react-router"
import { Box, Flex, Spinner, Text, Icon, Heading } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiFolder, FiFile } from "react-icons/fi"
import { FaMarkdown } from "react-icons/fa6"
import { AiOutlinePython } from "react-icons/ai"
import { SiAnaconda, SiJupyter } from "react-icons/si"
import axios from "axios"

import { ProjectsService, type GitItem } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/files",
)({
  component: Files,
})

const getIcon = (item: GitItem) => {
  if (item.type === "dir") {
    return FiFolder
  }
  if (item.name.endsWith(".py")) {
    return AiOutlinePython
  }
  if (item.name.endsWith(".ipynb")) {
    return SiJupyter
  }
  if (item.name.endsWith(".md")) {
    return FaMarkdown
  }
  if (item.name === "environment.yml") {
    return SiAnaconda
  }
  return FiFile
}

interface ItemProps {
  item: GitItem
}

// A component to render an individual item in the list of contents
// If a directory, expand to show files when clicked
// If a file, get content and display to the right in a viewer
function Item({ item }: ItemProps) {
  return (
    <Flex>
      <Icon as={getIcon(item)} alignSelf="center" mr={1} />
      <Text>{item.name}</Text>
    </Flex>
  )
}

function Files() {
  const { userName, projectName } = Route.useParams()
  const { isPending: filesPending, data: files } = useQuery({
    queryKey: ["projects", userName, projectName, "files"],
    queryFn: () =>
      ProjectsService.getProjectGitContents({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const localFilesRequest = useQuery({
    queryKey: ["local-files"],
    queryFn: () => axios.get("http://localhost:8866/ls"),
    retry: false,
  })

  if (Array.isArray(files)) {
    function sortByTypeAndName(a: GitItem, b: GitItem) {
      if (a.type === "dir" && b.type === "dir") {
        if (a.name < b.name) {
          return -1
        }
      } else if (a.type === "dir" && b.type === "file") {
        return -1
      } else if (a.type === "file" && b.type === "file") {
        if (a.name < b.name) {
          return -1
        }
      }
      return 0
    }
    files.sort(sortByTypeAndName)
  }

  return (
    <>
      <Heading size="md" mb={1}>
        All files
      </Heading>
      {filesPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          <Box minW="20%">
            <Heading size="s" mb={1}>
              Cloud
            </Heading>
            {Array.isArray(files)
              ? files?.map((file) => <Item key={file.path} item={file} />)
              : ""}
          </Box>
          <Box minW="20%">
            <Heading size="s" mb={1}>
              Local
            </Heading>
            {!localFilesRequest.error &&
            Array.isArray(localFilesRequest.data?.data)
              ? localFilesRequest.data?.data.map((file) => (
                  <Item key={file.path} item={file} />
                ))
              : "Local server not connected"}
          </Box>
        </Flex>
      )}
    </>
  )
}
