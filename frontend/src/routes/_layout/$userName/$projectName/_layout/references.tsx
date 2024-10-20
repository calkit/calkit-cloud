import {
  Box,
  Flex,
  Heading,
  Spinner,
  Text,
  Icon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Link,
  useDisclosure,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { IoLibraryOutline } from "react-icons/io5"
import { FiFile } from "react-icons/fi"
import { useState } from "react"

import { ProjectsService, type ReferenceEntry } from "../../../../../client"
import FileViewModal from "../../../../../components/References/FileViewModal"
import { BsFilePdf } from "react-icons/bs"
import PageMenu from "../../../../../components/Common/PageMenu"

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
    <TableContainer whiteSpace="wrap">
      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            <Th w="100px" />
            <Th />
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
  const { userName, projectName } = Route.useParams()
  const {
    isPending,
    error,
    data: allReferences,
  } = useQuery({
    queryKey: ["projects", userName, projectName, "references"],
    queryFn: () =>
      ProjectsService.getProjectReferences({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const fileViewModal = useDisclosure()
  const [selectedEntry, setSelectedEntry] = useState<ReferenceEntry>()
  const handleLinkClick = (entry: ReferenceEntry) => {
    if (!entry.url) {
      return
    }
    setSelectedEntry(entry)
    fileViewModal.onOpen()
  }

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
              <FileViewModal
                isOpen={fileViewModal.isOpen}
                onClose={fileViewModal.onClose}
                entry={selectedEntry}
              />
              {/* References table of contents */}
              <PageMenu>
                <Heading size="md" mb={1}>
                  References
                </Heading>
                {allReferences?.map((references) => (
                  <Box key={references.path}>
                    <Link href={`#${references.path}`}>
                      <Flex alignItems="center">
                        <Icon mr={1} as={IoLibraryOutline} />
                        <Text
                          isTruncated
                          noOfLines={1}
                          whiteSpace="nowrap"
                          overflow="hidden"
                          textOverflow="ellipsis"
                          display="inline-block"
                          maxW="100%"
                        >
                          {references.path}
                        </Text>
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
                              <Icon
                                as={entry.url ? BsFilePdf : FiFile}
                                mr={1}
                                onClick={() => handleLinkClick(entry)}
                              />
                              <Text
                                isTruncated
                                noOfLines={1}
                                whiteSpace="nowrap"
                                overflow="hidden"
                                textOverflow="ellipsis"
                                display="inline-block"
                                maxW="100%"
                              >
                                {entry.key}
                              </Text>
                            </Flex>
                          </Link>
                        ))}
                      </>
                    ) : (
                      ""
                    )}
                  </Box>
                ))}
              </PageMenu>
              {/* A view for all the reference items' content */}
              <Box pr={4}>
                {allReferences?.map((references) => (
                  <Box key={references.path} mb={4}>
                    <Heading size="md" id={references.path} mb={2}>
                      {references.path}
                    </Heading>
                    {references.entries?.map((entry) => (
                      <Box
                        key={entry.key}
                        borderRadius="lg"
                        borderWidth={1}
                        mb={2}
                        p={2}
                        boxSizing="border-box"
                      >
                        <Flex alignItems="center">
                          <Heading size="sm" id={references.path + entry.key}>
                            {entry.key}
                          </Heading>

                          <Text ml={1} fontSize="sm">
                            {entry.file_path ? (
                              <Link
                                onClick={() => {
                                  handleLinkClick(entry)
                                }}
                              >
                                {`(${entry.file_path})`}
                              </Link>
                            ) : (
                              ""
                            )}
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
