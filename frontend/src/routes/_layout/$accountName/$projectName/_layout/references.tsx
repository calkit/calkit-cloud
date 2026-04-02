import {
  Box,
  Flex,
  Heading,
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
  Button,
} from "@chakra-ui/react"
import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { IoLibraryOutline } from "react-icons/io5"
import { FiFile } from "react-icons/fi"
import { useState } from "react"

import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import { ProjectsService, type ReferenceEntry } from "../../../../../client"
import FileViewModal from "../../../../../components/References/FileViewModal"
import { BsFilePdf } from "react-icons/bs"
import PageMenu from "../../../../../components/Common/PageMenu"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/references",
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
  const { accountName, projectName } = Route.useParams()
  const layoutSearch = useSearch({
    from: "/_layout/$accountName/$projectName/_layout" as any,
    strict: false,
  }) as any
  const ref: string | undefined = layoutSearch?.ref
  const {
    isPending,
    error,
    data: allReferences,
  } = useQuery({
    queryKey: ["projects", accountName, projectName, "references", ref],
    queryFn: () =>
      ProjectsService.getProjectReferences({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })
  const fileViewModal = useDisclosure()
  const [selectedEntry, setSelectedEntry] = useState<ReferenceEntry>()
  const [visibleCount, setVisibleCount] = useState(25)
  const handleLinkClick = (entry: ReferenceEntry) => {
    if (!entry.url) {
      return
    }
    setSelectedEntry(entry)
    fileViewModal.onOpen()
  }

  // Flatten all entries for pagination
  const allEntries =
    allReferences?.flatMap((refs) =>
      (refs.entries ?? []).map((e) => ({ ...e, _refPath: refs.path })),
    ) ?? []
  const totalEntries = allEntries.length
  const visibleEntries = allEntries.slice(0, visibleCount)

  return (
    <>
      {isPending ? (
        <LoadingSpinner />
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
              <Box pr={4} flex={1}>
                {visibleEntries.map((entry) => (
                  <Box
                    key={`${entry._refPath}-${entry.key}`}
                    borderRadius="lg"
                    borderWidth={1}
                    mb={2}
                    p={2}
                    boxSizing="border-box"
                  >
                    <Flex alignItems="center">
                      <Heading size="sm" id={entry._refPath + entry.key}>
                        {entry.key}
                      </Heading>
                      <Text ml={1} fontSize="sm">
                        {entry.file_path ? (
                          <Link onClick={() => handleLinkClick(entry)}>
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
                {visibleCount < totalEntries && (
                  <Flex justify="center" mt={2} mb={4}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setVisibleCount((n) => n + 25)}
                    >
                      Show more ({totalEntries - visibleCount} remaining)
                    </Button>
                  </Flex>
                )}
              </Box>
            </Flex>
          )}
        </>
      )}
    </>
  )
}
