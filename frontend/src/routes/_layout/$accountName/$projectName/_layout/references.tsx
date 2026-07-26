import { CloseIcon } from "@chakra-ui/icons"
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { BsFilePdf } from "react-icons/bs"
import { FaPlus } from "react-icons/fa"
import { IoLibraryOutline } from "react-icons/io5"
import { MdEdit } from "react-icons/md"
import { z } from "zod"

import {
  ProjectsService,
  type ReferenceEntry,
  UsersService,
} from "../../../../../client"
import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import PageMenu from "../../../../../components/Common/PageMenu"
import Tooltip from "../../../../../components/Common/Tooltip"
import EditReferenceItemModal from "../../../../../components/References/EditReferenceItemModal"
import FileViewModal from "../../../../../components/References/FileViewModal"
import ImportFromZoteroModal from "../../../../../components/References/ImportFromZoteroModal"
import NewReferencesCollection from "../../../../../components/References/NewReferencesCollection"
import ReferenceItemModal from "../../../../../components/References/ReferenceItemModal"
import ReferencesInfoPanel from "../../../../../components/References/ReferencesInfoPanel"
import useProject from "../../../../../hooks/useProject"
import { formatBibField } from "../../../../../lib/bibtex"

const referencesSearchSchema = z.object({
  // Selected collection path, so a link restores the same collection.
  path: z.string().optional(),
  // Open reference item (its bib key), for the item detail modal.
  item: z.string().optional(),
  import_zotero_open: z.boolean().optional(),
  new_collection_open: z.boolean().optional(),
  resolved: z.boolean().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/references",
)({
  component: References,
  validateSearch: (search) => referencesSearchSchema.parse(search),
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
            ? Object.entries(referenceEntry.attrs).map(([k, v]) => {
                const value = formatBibField(k, String(v))
                const key = k.toLowerCase()
                let href: string | undefined
                if (key === "doi") {
                  href = value.startsWith("http")
                    ? value
                    : `https://doi.org/${value}`
                } else if (key === "url") {
                  href = value
                }
                return (
                  <Tr key={k}>
                    <Td>{k}</Td>
                    <Td>
                      {href ? (
                        <Link href={href} isExternal variant="blue">
                          {value}
                        </Link>
                      ) : (
                        value
                      )}
                    </Td>
                  </Tr>
                )
              })
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
  const navigate = useNavigate({ from: Route.fullPath })
  const {
    path: selectedPath,
    item: openItemKey,
    import_zotero_open: importZoteroOpen,
    new_collection_open: newCollectionOpen,
    resolved: showResolved,
  } = Route.useSearch()
  const { userHasWriteAccess } = useProject(accountName, projectName)
  const connectedAccountsQuery = useQuery({
    queryFn: () => UsersService.getUserConnectedAccounts(),
    queryKey: ["user", "connected-accounts"],
  })
  const zoteroConnected = Boolean(connectedAccountsQuery.data?.zotero)
  const openImportZotero = () =>
    navigate({ search: (prev) => ({ ...prev, import_zotero_open: true }) })
  const closeImportZotero = () =>
    navigate({ search: (prev) => ({ ...prev, import_zotero_open: undefined }) })
  const openNewCollection = () =>
    navigate({ search: (prev) => ({ ...prev, new_collection_open: true }) })
  const closeNewCollection = () =>
    navigate({
      search: (prev) => ({ ...prev, new_collection_open: undefined }),
    })
  const selectCollection = (path: string) =>
    navigate({ search: (prev) => ({ ...prev, path }) })
  const openItem = (key: string) =>
    navigate({ search: (prev) => ({ ...prev, item: key }) })
  const closeItem = () =>
    navigate({ search: (prev) => ({ ...prev, item: undefined }) })
  const setShowResolved = (resolved: boolean) =>
    navigate({
      search: (prev) => ({ ...prev, resolved: resolved || undefined }),
    })
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
  const editItemModal = useDisclosure()
  const [editEntry, setEditEntry] = useState<ReferenceEntry>()
  const [selectedEntry, setSelectedEntry] = useState<ReferenceEntry>()
  const [visibleCount, setVisibleCount] = useState(25)
  const [searchText, setSearchText] = useState("")
  // The filter runs off a debounced copy of the input so typing stays smooth on
  // large collections; the input value itself updates immediately.
  const [debouncedQuery, setDebouncedQuery] = useState("")
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedQuery(searchText.trim().toLowerCase()),
      200,
    )
    return () => clearTimeout(t)
  }, [searchText])
  const handleLinkClick = (entry: ReferenceEntry) => {
    if (!entry.url) {
      return
    }
    setSelectedEntry(entry)
    fileViewModal.onOpen()
  }
  // Default to the first collection when none is selected in the URL.
  const selectedCollection =
    allReferences?.find((r) => r.path === selectedPath) ?? allReferences?.[0]
  const entries = selectedCollection?.entries ?? []
  const selectedItem = openItemKey
    ? entries.find((e) => e.key === openItemKey)
    : undefined
  // Precompute a search haystack per entry (key + formatted attribute values)
  // once per collection, so filtering on each keystroke doesn't re-format every
  // value.
  const entryHaystacks = useMemo(
    () =>
      entries.map((e) => ({
        entry: e,
        haystack: [
          e.key,
          ...Object.entries(e.attrs ?? {}).map(([k, v]) =>
            formatBibField(k, String(v)),
          ),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [entries],
  )
  const filteredEntries = debouncedQuery
    ? entryHaystacks
        .filter((x) => x.haystack.includes(debouncedQuery))
        .map((x) => x.entry)
    : entries
  const totalEntries = filteredEntries.length
  const visibleEntries = filteredEntries.slice(0, visibleCount)
  const handleSearchChange = (value: string) => {
    setSearchText(value)
    setVisibleCount(25)
  }

  return (
    <>
      {isPending ? (
        <LoadingSpinner />
      ) : error ? (
        <Box>
          <Text>Could not read references</Text>
        </Box>
      ) : (
        <Flex width="full" height="100%" gap={0}>
          <FileViewModal
            isOpen={fileViewModal.isOpen}
            onClose={fileViewModal.onClose}
            entry={selectedEntry}
          />
          {userHasWriteAccess ? (
            <>
              <ImportFromZoteroModal
                isOpen={Boolean(importZoteroOpen)}
                onClose={closeImportZotero}
                ownerName={accountName}
                projectName={projectName}
              />
              <NewReferencesCollection
                isOpen={Boolean(newCollectionOpen)}
                onClose={closeNewCollection}
                ownerName={accountName}
                projectName={projectName}
              />
              {selectedCollection ? (
                <EditReferenceItemModal
                  isOpen={editItemModal.isOpen}
                  onClose={editItemModal.onClose}
                  ownerName={accountName}
                  projectName={projectName}
                  bibPath={selectedCollection.path}
                  entry={editEntry}
                />
              ) : null}
            </>
          ) : null}
          {selectedCollection ? (
            <ReferenceItemModal
              isOpen={Boolean(openItemKey && selectedItem)}
              onClose={closeItem}
              ownerName={accountName}
              projectName={projectName}
              bibPath={selectedCollection.path}
              entry={selectedItem}
              userHasWriteAccess={userHasWriteAccess}
            />
          ) : null}
          {/* Left: collection index (selectable) */}
          <PageMenu>
            <Flex align="center" mb={2}>
              <Heading size="md">References</Heading>
              {userHasWriteAccess ? (
                <Menu>
                  <MenuButton
                    as={Button}
                    variant="primary"
                    height="25px"
                    width="9px"
                    px={1}
                    ml={2}
                  >
                    <Icon as={FaPlus} fontSize="xs" />
                  </MenuButton>
                  <Portal>
                    <MenuList zIndex="popover">
                      <MenuItem onClick={openNewCollection}>
                        New references collection
                      </MenuItem>
                      <Tooltip
                        label="Connect your Zotero account in settings first"
                        isDisabled={zoteroConnected}
                      >
                        <MenuItem
                          onClick={openImportZotero}
                          isDisabled={!zoteroConnected}
                        >
                          Import from Zotero
                        </MenuItem>
                      </Tooltip>
                    </MenuList>
                  </Portal>
                </Menu>
              ) : null}
            </Flex>
            {allReferences?.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                No references yet.
              </Text>
            ) : null}
            {allReferences?.map((references) => {
              const isSelected = references.path === selectedCollection?.path
              return (
                <Tooltip
                  key={references.path}
                  label={references.path}
                  placement="right"
                >
                  <HStack
                    px={1}
                    py={0.5}
                    borderRadius="md"
                    cursor="pointer"
                    fontWeight={isSelected ? "semibold" : "normal"}
                    color={isSelected ? "blue.500" : undefined}
                    _hover={{ color: "blue.500" }}
                    onClick={() => selectCollection(references.path)}
                    spacing={1}
                  >
                    <Icon as={IoLibraryOutline} flexShrink={0} />
                    <Text fontSize="sm" noOfLines={1}>
                      {references.path}
                    </Text>
                    {references.zotero ? (
                      <Badge colorScheme="red" fontSize="0.6em">
                        Zotero
                      </Badge>
                    ) : null}
                  </HStack>
                </Tooltip>
              )
            })}
          </PageMenu>
          {/* Center: selected collection's entries. A flex column with a fixed
              search header and an independently scrolling entries body, like
              the left/right columns. */}
          <Box
            flex={1}
            minW={0}
            mr={6}
            display="flex"
            flexDirection="column"
            minH={0}
          >
            {selectedCollection ? (
              <>
                <HStack mb={3} align="center">
                  <InputGroup maxW="400px">
                    <Input
                      placeholder="Search references"
                      size="sm"
                      value={searchText}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          handleSearchChange("")
                        }
                      }}
                      autoComplete="off"
                      data-form-type="other"
                      data-lpignore="true"
                    />
                    {searchText ? (
                      <InputRightElement h="100%">
                        <IconButton
                          aria-label="Clear search"
                          icon={<CloseIcon boxSize={2.5} />}
                          size="xs"
                          variant="ghost"
                          onClick={() => handleSearchChange("")}
                        />
                      </InputRightElement>
                    ) : null}
                  </InputGroup>
                  {userHasWriteAccess ? (
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<FaPlus />}
                      flexShrink={0}
                      onClick={() => {
                        setEditEntry(undefined)
                        editItemModal.onOpen()
                      }}
                    >
                      Add item
                    </Button>
                  ) : null}
                </HStack>
                <Box flex={1} overflowY="auto" minH={0} pb={4}>
                  {totalEntries === 0 ? (
                    <Text fontSize="sm" color="gray.500">
                      {entries.length === 0
                        ? "This collection has no references."
                        : "No references match your search."}
                    </Text>
                  ) : null}
                  {visibleEntries.map((entry) => (
                    <Box
                      key={`${selectedCollection.path}-${entry.key}`}
                      borderRadius="lg"
                      borderWidth={1}
                      mb={2}
                      p={2}
                      boxSizing="border-box"
                    >
                      <Flex alignItems="center">
                        <Heading
                          size="sm"
                          cursor="pointer"
                          _hover={{ color: "blue.500" }}
                          onClick={() => openItem(entry.key)}
                        >
                          {entry.key}
                        </Heading>
                        {entry.type ? (
                          <Badge ml={2} colorScheme="purple" fontSize="0.6em">
                            {entry.type}
                          </Badge>
                        ) : null}
                        <Text ml={1} fontSize="sm">
                          {entry.file_path ? (
                            <Link onClick={() => handleLinkClick(entry)}>
                              {`(${entry.file_path})`}
                            </Link>
                          ) : (
                            ""
                          )}
                        </Text>
                        {entry.has_pdf || entry.url ? (
                          <Icon
                            as={BsFilePdf}
                            ml={1}
                            color="red.500"
                            cursor="pointer"
                            onClick={() => openItem(entry.key)}
                          />
                        ) : null}
                        {entry.note_count ? (
                          <Badge ml={1} colorScheme="blue" fontSize="0.6em">
                            {entry.note_count} note
                            {entry.note_count > 1 ? "s" : ""}
                          </Badge>
                        ) : null}
                        {userHasWriteAccess ? (
                          <IconButton
                            aria-label="Edit reference"
                            icon={<MdEdit />}
                            size="xs"
                            variant="ghost"
                            ml="auto"
                            onClick={() => {
                              setEditEntry(entry)
                              editItemModal.onOpen()
                            }}
                          />
                        ) : null}
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
              </>
            ) : null}
          </Box>
          {/* Right: info + comments for the selected collection */}
          {selectedCollection ? (
            <Box w="280px" flexShrink={0} overflowY="auto">
              <ReferencesInfoPanel
                references={selectedCollection}
                ownerName={accountName}
                projectName={projectName}
                gitRef={ref}
                userHasWriteAccess={userHasWriteAccess}
                showResolved={Boolean(showResolved)}
                onShowResolvedChange={setShowResolved}
              />
            </Box>
          ) : null}
        </Flex>
      )}
    </>
  )
}
