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
  Link,
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
    <TableContainer mb={6} whiteSpace={"wrap"}>
      <Table variant="simple" size={"sm"}>
        <Thead>
          <Tr>
            <Th width={"100px"}>Property</Th>
            <Th>Value</Th>
          </Tr>
        </Thead>
        <Tbody>
          {referenceEntry.attrs
            ? Object.entries(referenceEntry.attrs).map(([k, v]) => (
                <Tr key={k}>
                  <Td>{k}</Td>
                  <Td>{String(v)}</Td>
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
            <Flex width={"full"}>
              {/* References table of contents */}
              <Box>
                <Box
                  bg={secBgColor}
                  px={4}
                  py={2}
                  borderRadius="lg"
                  mr={8}
                  position={"sticky"}
                  top={50}
                  maxH="80%"
                  overflowY="auto"
                >
                  <Heading size="md" mb={1}>
                    References
                  </Heading>
                  {allReferences?.map((references) => (
                    <Box key={references.path}>
                      <Link href={`#${references.path}`}>
                        <Flex alignItems="center">
                          <Icon mr={1} as={IoLibraryOutline} />
                          <Text>{references.path}</Text>
                        </Flex>
                      </Link>
                      {references ? (
                        <>
                          {references.entries?.map((entry) => (
                            <Link
                              key={entry.key}
                              href={`#${references.path}${entry.key}`}
                            >
                              <Flex ml={3} alignItems="center">
                                <Icon as={FiFile} mr={1} />
                                <Text>{entry.key}</Text>
                              </Flex>
                            </Link>
                          ))}
                        </>
                      ) : (
                        ""
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
              {/* A view for all the reference items' content */}
              <Box pr={4}>
                {allReferences?.map((references) => (
                  <Box key={references.path} mb={4}>
                    <Heading size="md" id={references.path} mb={2}>
                      {references.path}
                    </Heading>
                    {references.entries?.map((entry) => (
                      <Box key={entry.key}>
                        <Flex alignItems={"center"} mb={2}>
                          <Heading size="sm" id={references.path + entry.key}>
                            {entry.key}
                          </Heading>
                          <Text ml={1} fontSize={"sm"}>
                            {entry.file_path ? `(${entry.file_path})` : ""}
                          </Text>
                        </Flex>
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
