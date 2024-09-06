import {
  Box,
  Flex,
  Heading,
  useColorModeValue,
  Spinner,
  Text,
  Icon,
  Table,
  Thead,
  Tbody,
  Tfoot,
  Tr,
  Th,
  Td,
  TableCaption,
  TableContainer,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { IoLibraryOutline } from "react-icons/io5"
import { FiFile } from "react-icons/fi"

import { ProjectsService, type ReferenceEntry } from "../../../../../client"
import { useState } from "react"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/references",
)({
  component: References,
})

interface ReferenceEntryTableProps {
  referenceEntry: ReferenceEntry
}

function ReferenceEntryTable({ referenceEntry }: ReferenceEntryTableProps) {
  return (
    <TableContainer mb={4}>
      <Table variant="simple" size={"sm"}>
        <Thead>
          <Tr>
            <Th>Property</Th>
            <Th>Value</Th>
          </Tr>
        </Thead>
        <Tbody>
          {referenceEntry.attrs
            ? Object.entries(referenceEntry.attrs).map(([k, v]) => (
                <Tr key={k}>
                  <Td>{k}</Td>
                  <Td>{v}</Td>
                </Tr>
              ))
            : ""}
        </Tbody>
      </Table>
    </TableContainer>
  )
}

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
              <Box
                bg={secBgColor}
                px={4}
                py={2}
                borderRadius="lg"
                mr={8}
                position={"sticky"}
                top={50}
              >
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
              {/* A view for all the reference items' content */}
              <Box minW={"60%"}>
                {allReferences?.map((references) => (
                  <Box key={references.path}>
                    <Heading size="md" id={references.path} mb={2}>
                      {references.path}
                    </Heading>
                    {references.entries?.map((entry) => (
                      <Box key={entry.key}>
                        <Heading
                          size="sm"
                          mb={1}
                          pl={4}
                          id={references.path + entry.key}
                        >
                          {entry.key}
                        </Heading>
                        <ReferenceEntryTable referenceEntry={entry} />
                      </Box>
                    ))}
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
