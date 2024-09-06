import {
  Box,
  Flex,
  Heading,
  useColorModeValue,
  Spinner,
  Text,
  Icon,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { IoLibraryOutline } from "react-icons/io5"

import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/references",
)({
  component: References,
})

function References() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { userName, projectName } = Route.useParams()
  const {
    isPending,
    error,
    data: references,
  } = useQuery({
    queryKey: ["projects", userName, projectName, "References"],
    queryFn: () =>
      ProjectsService.getProjectReferences({
        ownerName: userName,
        projectName: projectName,
      }),
  })

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
              <Text>Could not read references</Text>
            </Box>
          ) : (
            <Flex>
              <Box bg={secBgColor} px={4} py={2} borderRadius="lg">
                <Heading size="md" mb={1}>
                  References
                </Heading>
                {references?.map((reference) => (
                  <Box key={reference.path}>
                    <Flex alignItems="center">
                      <Icon mr={1} as={IoLibraryOutline} />
                      <Text>{reference.path}</Text>
                    </Flex>
                  </Box>
                ))}
              </Box>
            </Flex>
          )}
        </>
      )}
    </>
  )
}
