import { createFileRoute } from "@tanstack/react-router"
import { Heading, Box, Flex, Spinner, Text, Icon } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiFolder, FiFile } from "react-icons/fi"

import { ProjectsService, type GitItem } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/files",
)({
  component: Files,
})

function Files() {
  const { userName, projectName } = Route.useParams()
  const { isPending, data: project } = useQuery({
    queryKey: ["projects", userName, projectName],
    queryFn: () =>
      ProjectsService.getProjectByName({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  // TODO: Replace below with call to fetch files
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
      {isPending || filesPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <Heading
            size="lg"
            textAlign={{ base: "center", md: "left" }}
            pt={8}
            pb={3}
          >
            All files: {project?.name}
          </Heading>
          <Box>
            {files?.map((file) => (
              <Text key={file.name}>
                <Icon as={file.type === "dir" ? FiFolder : FiFile} />{" "}
                {file.name}
              </Text>
            ))}
          </Box>
        </Box>
      )}
    </>
  )
}
