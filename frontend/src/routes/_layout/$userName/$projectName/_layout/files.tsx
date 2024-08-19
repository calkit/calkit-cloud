import { createFileRoute } from "@tanstack/react-router"
import { Box, Flex, Spinner, Text, Icon } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiFolder, FiFile } from "react-icons/fi"
import { FaMarkdown } from "react-icons/fa6"
import { AiOutlinePython } from "react-icons/ai"
import { SiAnaconda, SiJupyter } from "react-icons/si"

import { ProjectsService, type GitItem } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/files",
)({
  component: Files,
})

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

  return (
    <>
      {filesPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <Box>
            {Array.isArray(files)
              ? files?.map((file) => (
                  <Flex key={file.name}>
                    <Icon as={getIcon(file)} alignSelf="center" mr={1} />
                    <Text>{file.name}</Text>
                  </Flex>
                ))
              : ""}
          </Box>
        </Box>
      )}
    </>
  )
}
