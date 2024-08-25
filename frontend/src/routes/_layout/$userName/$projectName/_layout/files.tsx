import { createFileRoute } from "@tanstack/react-router"
import { Box, Flex, Spinner, Text, Icon, Heading } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiFolder, FiFile } from "react-icons/fi"
import { FaMarkdown } from "react-icons/fa6"
import { AiOutlinePython } from "react-icons/ai"
import { SiAnaconda, SiJupyter } from "react-icons/si"
import { useState } from "react"
import { FaRegFolderOpen } from "react-icons/fa"

import { ProjectsService, type GitItem } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/files",
)({
  component: Files,
})

const getIcon = (item: GitItem, isExpanded = false) => {
  if (item.type === "dir" && !isExpanded) {
    return FiFolder
  }
  if (item.type === "dir" && isExpanded) {
    return FaRegFolderOpen
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
  level?: number
}

// A component to render an individual item in the list of contents
// If a directory, expand to show files when clicked
// If a file, get content and display to the right in a viewer
function Item({ item, level }: ItemProps) {
  const indent = level ? level : 0
  const [isExpanded, setIsExpanded] = useState(false)
  const handleClick = (e) => {
    setIsExpanded(!isExpanded)
  }
  const { userName, projectName } = Route.useParams()
  const { isPending, data } = useQuery({
    queryKey: ["projects", userName, projectName, "files", item.path],
    queryFn: () =>
      ProjectsService.getProjectGitContents({
        ownerName: userName,
        projectName: projectName,
        path: item.path,
      }),
    enabled: isExpanded,
  })

  return (
    <>
      <Flex cursor={"pointer"} onClick={handleClick} ml={indent * 4}>
        <Icon as={getIcon(item, isExpanded)} alignSelf="center" mr={1} />
        <Text>{item.name}</Text>
      </Flex>
      {isExpanded && item.type === "dir" ? (
        <Box>
          {data?.map((subItem: GitItem) => (
            <Item key={subItem.name} item={subItem} level={indent + 1} />
          ))}
        </Box>
      ) : (
        ""
      )}
    </>
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
          <Box>
            {Array.isArray(files)
              ? files?.map((file) => <Item key={file.name} item={file} />)
              : ""}
          </Box>
        </Flex>
      )}
    </>
  )
}
