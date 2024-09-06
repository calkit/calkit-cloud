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
import { FiFile } from "react-icons/fi"

import { ProjectsService } from "../../../../../client"
import { useState } from "react"

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
    data: allReferences,
  } = useQuery({
    queryKey: ["projects", userName, projectName, "References"],
    queryFn: () =>
      ProjectsService.getProjectReferences({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const [selectedRefsIndex, setSelectedRefsIndex] = useState(0)

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
                {allReferences?.map((references, index) => (
                  <Box key={references.path}>
                    <Flex
                      alignItems="center"
                      cursor="pointer"
                      onClick={() => setSelectedRefsIndex(index)}
                    >
                      <Icon mr={1} as={IoLibraryOutline} />
                      <Text>{references.path}</Text>
                    </Flex>
                    {index === selectedRefsIndex && references ? (
                      <>
                        {references.entries?.map((entry) => (
                          <Flex ml={3} key={entry.key} alignItems="center">
                            <Icon as={FiFile} mr={1} />
                            <Text>{entry.key}</Text>
                          </Flex>
                        ))}
                      </>
                    ) : (
                      ""
                    )}
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
