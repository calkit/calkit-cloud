import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Box,
  Button,
  Flex,
  Spinner,
  Text,
  Icon,
  Heading,
  useDisclosure,
  IconButton,
  useColorModeValue,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiFolder, FiFile, FiDatabase } from "react-icons/fi"
import { FaMarkdown, FaPlus, FaLock } from "react-icons/fa6"
import { AiOutlinePython } from "react-icons/ai"
import { SiAnaconda, SiJupyter } from "react-icons/si"
import { useState } from "react"
import {
  FaDocker,
  FaList,
  FaRegFileImage,
  FaRegFolderOpen,
  FaSync,
} from "react-icons/fa"
import { BsFiletypeYml } from "react-icons/bs"
import { z } from "zod"

import { type ContentsItem } from "../../../../../client"
import UploadFile from "../../../../../components/Files/UploadFile"
import PageMenu from "../../../../../components/Common/PageMenu"
import FileContent from "../../../../../components/Files/FileContent"
import SelectedItemInfo from "../../../../../components/Files/SelectedItemInfo"
import useProject from "../../../../../hooks/useProject"
import { getProjectContentsAtRef } from "../../../../../lib/projectRefApi"
import { RefPicker } from "../../../../../components/Common/RefPicker"

const fileSearchSchema = z.object({
  path: z.string().catch(""),
  ref: z.string().optional(),
  compareRef: z.string().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/files",
)({
  component: Files,
  validateSearch: (search) => fileSearchSchema.parse(search),
})

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

interface ItemProps {
  item: ContentsItem
  level?: number
  selectedPath: string
  setSelectedPath: (path: string) => void
}

// A component to render an individual item in the list of contents
// If a directory, expand to show files when clicked
// If a file, get content and display to the right in a viewer
function Item({ item, level, selectedPath, setSelectedPath }: ItemProps) {
  const bgActive = useColorModeValue("#E2E8F0", "#4A5568")
  const navigate = useNavigate({ from: Route.fullPath })
  const indent = level ? level : 0
  const [isExpanded, setIsExpanded] = useState(
    pathShouldBeExpanded(item.path, selectedPath),
  )
  const { accountName, projectName } = Route.useParams()
  const { ref } = Route.useSearch()
  const { data } = useQuery({
    queryKey: ["projects", accountName, projectName, "files", item.path, ref],
    queryFn: () =>
      getProjectContentsAtRef({
        ownerName: accountName,
        projectName: projectName,
        path: item.path,
        ref,
      }),
    enabled: isExpanded,
  })

  // Determine if a given path should be expanded based on whether or not it is
  // a parent directory of the selected path
  function pathShouldBeExpanded(path: string, selectedPath: string) {
    if (path === selectedPath) {
      return true
    }
    const parentTokens = path.split("/").filter((i) => i.length)
    const childTokens = selectedPath.split("/").filter((i) => i.length)
    return parentTokens.every((t, i) => childTokens[i] === t)
  }

  // Helper function to get the appropriate icon based on item type
  const getIcon = (item: ContentsItem, isExpanded = false) => {
    if (item.calkit_object) {
      if (item.calkit_object.kind === "dataset" && item.type !== "dir") {
        return FiDatabase
      }
      if (item.calkit_object.kind === "figure") {
        return FaRegFileImage
      }
      if (item.calkit_object.kind === "references") {
        return FaList
      }
    }
    if (item.type === "dir" && !isExpanded) {
      return FiFolder
    }
    if (item.type === "dir" && isExpanded) {
      return FaRegFolderOpen
    }
    if (item.name.endsWith(".png")) {
      return FaRegFileImage
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
    if (item.name.endsWith("yaml") || item.name === "dvc.lock") {
      return BsFiletypeYml
    }
    if (item.name === "environment.yml") {
      return SiAnaconda
    }
    if (item.name === "Dockerfile") {
      return FaDocker
    }
    return FiFile
  }

  const handleClick = () => {
    setIsExpanded(!isExpanded)
    setSelectedPath(item.path)
    navigate({
      search: (prev) => ({
        ...prev,
        path: item.path,
      }),
    })
  }

  if (Array.isArray(data)) {
    data.sort(sortByTypeAndName)
  }

  const itemIsSelected = item.path === selectedPath

  return (
    <>
      <Flex
        cursor="pointer"
        onClick={handleClick}
        ml={indent * 4}
        bg={itemIsSelected ? bgActive : ""}
        borderRadius="md"
        px="2px"
      >
        <Icon
          as={getIcon(item, isExpanded)}
          alignSelf="center"
          mr={1}
          color={item.calkit_object ? "green.500" : "default"}
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
          {item.name}
        </Text>
        {item.lock ? (
          <Icon
            as={FaLock}
            ml={0.1}
            color={"yellow.500"}
            alignSelf="center"
            height={"12px"}
          />
        ) : (
          ""
        )}
      </Flex>
      {isExpanded && item.type === "dir" ? (
        <Box>
          {data?.dir_items?.map((subItem: ContentsItem) => (
            <Item
              key={subItem.name}
              item={subItem}
              level={indent + 1}
              selectedPath={selectedPath}
              setSelectedPath={setSelectedPath}
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
  const { accountName, projectName } = Route.useParams()
  const { path, ref, compareRef } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { userHasWriteAccess } = useProject(accountName, projectName)
  const [refInput, setRefInput] = useState(ref ?? "")
  const [compareRefInput, setCompareRefInput] = useState(compareRef ?? "")

  const {
    isPending: filesPending,
    data: files,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["projects", accountName, projectName, "files", ref],
    queryFn: () =>
      getProjectContentsAtRef({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })
  const [selectedPath, setSelectedPath] = useState<string>(path)
  const selectedItemQuery = useQuery({
    queryKey: [
      "projects",
      accountName,
      projectName,
      "files",
      selectedPath,
      ref,
    ],
    queryFn: () =>
      getProjectContentsAtRef({
        ownerName: accountName,
        projectName: projectName,
        path: selectedPath,
        ref,
      }),
    enabled: selectedPath !== undefined,
  })
  const compareItemQuery = useQuery({
    queryKey: [
      "projects",
      accountName,
      projectName,
      "files",
      selectedPath,
      compareRef,
      "compare",
    ],
    queryFn: () =>
      getProjectContentsAtRef({
        ownerName: accountName,
        projectName: projectName,
        path: selectedPath,
        ref: compareRef,
      }),
    enabled: selectedPath !== undefined && Boolean(compareRef),
    retry: false,
  })
  const fileUploadModal = useDisclosure()
  if (Array.isArray(files?.dir_items)) {
    files.dir_items.sort(sortByTypeAndName)
  }
  const refresh = () => {
    refetch()
    selectedItemQuery.refetch()
    if (compareRef) {
      compareItemQuery.refetch()
    }
  }

  const applyRefs = () => {
    navigate({
      search: (prev) => ({
        ...prev,
        ref: refInput || undefined,
        compareRef: compareRefInput || undefined,
      }),
    })
  }

  const clearRefs = () => {
    setRefInput("")
    setCompareRefInput("")
    navigate({
      search: (prev) => ({
        ...prev,
        ref: undefined,
        compareRef: undefined,
      }),
    })
  }

  return (
    <>
      {filesPending || isRefetching ? (
        <Flex justify="center" align="center" height="full" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex height={"100%"}>
          <PageMenu>
            <Box mb={2}>
              <Text fontSize="xs" mb={1}>
                Git refs
              </Text>
              <RefPicker
                ownerName={accountName}
                projectName={projectName}
                value={refInput}
                onChange={setRefInput}
                placeholder="Primary ref (main, v1.2.0, ...)"
              />
              <Box mt={2} />
              <RefPicker
                ownerName={accountName}
                projectName={projectName}
                value={compareRefInput}
                onChange={setCompareRefInput}
                placeholder="Compare ref (optional)"
              />
              <Flex gap={1} mt={2}>
                <Button size="xs" onClick={applyRefs}>
                  Apply
                </Button>
                <Button size="xs" variant="ghost" onClick={clearRefs}>
                  Clear
                </Button>
              </Flex>
            </Box>
            <Flex gap={2}>
              <Heading size="md" mb={1}>
                All files
              </Heading>
              {userHasWriteAccess && !ref && !compareRef ? (
                <>
                  <IconButton
                    variant="primary"
                    height="25px"
                    fontSize="sm"
                    onClick={fileUploadModal.onOpen}
                    icon={<FaPlus />}
                    aria-label="upload"
                  />
                </>
              ) : (
                ""
              )}
              <IconButton
                aria-label="refresh"
                height="25px"
                icon={<FaSync />}
                onClick={refresh}
              />
            </Flex>
            <UploadFile
              isOpen={fileUploadModal.isOpen}
              onClose={fileUploadModal.onClose}
            />
            {Array.isArray(files?.dir_items)
              ? files.dir_items?.map((file) => (
                  <Item
                    key={file.name}
                    item={file}
                    selectedPath={selectedPath}
                    setSelectedPath={setSelectedPath}
                  />
                ))
              : ""}
          </PageMenu>
          <Box flex={1} minW={0} maxH="82vh" overflowY="auto" overflowX="auto">
            {selectedPath !== undefined &&
            (selectedItemQuery.isPending || selectedItemQuery.isRefetching) ? (
              <Flex justify="center" align="center" height="full" width="full">
                <Spinner size="xl" color="ui.main" />
              </Flex>
            ) : (
              <>
                {compareRef ? (
                  <Flex gap={4} alignItems="flex-start">
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="bold" mb={1}>
                        {ref || "default"}
                      </Text>
                      {selectedItemQuery?.data?.content ||
                      selectedItemQuery?.data?.url ? (
                        <FileContent item={selectedItemQuery?.data} />
                      ) : (
                        <Text>No artifact found for this ref.</Text>
                      )}
                    </Box>
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="bold" mb={1}>
                        {compareRef}
                      </Text>
                      {compareItemQuery.isPending ? (
                        <Spinner size="md" color="ui.main" />
                      ) : compareItemQuery.data?.content ||
                        compareItemQuery.data?.url ? (
                        <FileContent item={compareItemQuery.data} />
                      ) : (
                        <Text>No artifact found for this ref.</Text>
                      )}
                    </Box>
                  </Flex>
                ) : selectedItemQuery?.data?.content ||
                  selectedItemQuery?.data?.url ? (
                  <FileContent item={selectedItemQuery?.data} />
                ) : (
                  ""
                )}
              </>
            )}
          </Box>
          <Box w="280px" flexShrink={0} px={4} borderLeftWidth={1} borderColor="inherit">
            <Heading size="md" mb={2}>Info</Heading>
            {selectedPath !== undefined &&
            (selectedItemQuery.isPending || selectedItemQuery.isRefetching) ? (
              ""
            ) : (
              <>
                {selectedItemQuery?.data && selectedPath !== undefined ? (
                  <SelectedItemInfo
                    selectedItem={selectedItemQuery.data}
                    ownerName={accountName}
                    projectName={projectName}
                    userHasWriteAccess={userHasWriteAccess}
                  />
                ) : (
                  ""
                )}
              </>
            )}
          </Box>
        </Flex>
      )}
    </>
  )
}
