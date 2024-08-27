import { createFileRoute } from "@tanstack/react-router"
import {
  Box,
  Flex,
  Spinner,
  Text,
  Icon,
  Heading,
  Code,
  Badge,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiFolder, FiFile } from "react-icons/fi"
import { FaMarkdown } from "react-icons/fa6"
import { AiOutlinePython } from "react-icons/ai"
import { SiAnaconda, SiJupyter } from "react-icons/si"
import { useState } from "react"
import { FaRegFolderOpen } from "react-icons/fa"

import { ProjectsService, type ContentsItem } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/files",
)({
  component: Files,
})

const getIcon = (item: ContentsItem, isExpanded = false) => {
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
  item: ContentsItem
  level?: number
  setSelectedFile: (file: ContentsItem) => void
}

// A component to render an individual item in the list of contents
// If a directory, expand to show files when clicked
// If a file, get content and display to the right in a viewer
function Item({ item, level, setSelectedFile }: ItemProps) {
  const indent = level ? level : 0
  const [isExpanded, setIsExpanded] = useState(false)
  const { userName, projectName } = Route.useParams()
  const { isPending, data } = useQuery({
    queryKey: ["projects", userName, projectName, "files", item.path],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: item.path,
      }),
    enabled: isExpanded,
  })
  const handleClick = (e) => {
    setIsExpanded(!isExpanded)
    setSelectedFile(item)
  }

  return (
    <>
      <Flex cursor={"pointer"} onClick={handleClick} ml={indent * 4}>
        <Icon as={getIcon(item, isExpanded)} alignSelf="center" mr={1} />
        <Text>{item.name}</Text>
      </Flex>
      {isExpanded && item.type === "dir" ? (
        <Box>
          {data?.map((subItem: ContentsItem) => (
            <Item
              key={subItem.name}
              item={subItem}
              level={indent + 1}
              setSelectedFile={setSelectedFile}
            />
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
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const [selectedFile, setSelectedFile] = useState<ContentsItem | undefined>(
    undefined,
  )
  const selectedFileQuery = useQuery({
    queryKey: ["projects", userName, projectName, "files", selectedFile?.path],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: selectedFile?.path,
      }),
    enabled: selectedFile !== undefined,
  })

  if (Array.isArray(files)) {
    function sortByTypeAndName(a: ContentsItem, b: ContentsItem) {
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
      {filesPending ? (
        <Flex justify="center" align="center" height="full" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          <Box
            mr={10}
            height="700px"
            width="200px"
            overflowX="auto"
            overflowY="auto"
          >
            {Array.isArray(files)
              ? files?.map((file) => (
                  <Item
                    key={file.name}
                    item={file}
                    setSelectedFile={setSelectedFile}
                  />
                ))
              : ""}
          </Box>
          <Box minW={"750px"}>
            {selectedFile !== undefined &&
            (selectedFileQuery.isPending || selectedFileQuery.isRefetching) ? (
              <Flex justify="center" align="center" height="full" width="full">
                <Spinner size="xl" color="ui.main" />
              </Flex>
            ) : (
              <Code
                p={2}
                borderRadius={"lg"}
                display="block"
                whiteSpace="pre"
                height="700px"
                overflowY="auto"
                maxW="750px"
                overflowX="auto"
              >
                {selectedFileQuery.data?.content
                  ? String(atob(selectedFileQuery.data?.content))
                  : ""}
              </Code>
            )}
          </Box>
          <Box mx={5}>
            <Heading size="md">Info</Heading>
            {selectedFile ? (
              <Box>
                <Text>Name: {selectedFile.name}</Text>
                <Text>Type: {selectedFile.type}</Text>
                <Text>Size: {selectedFile.size}</Text>
                {selectedFile.calkit_object ? (
                  <Badge bgColor="green.500">
                    {selectedFile.calkit_object.kind}
                  </Badge>
                ) : (
                  ""
                )}
              </Box>
            ) : (
              ""
            )}
          </Box>
        </Flex>
      )}
    </>
  )
}
