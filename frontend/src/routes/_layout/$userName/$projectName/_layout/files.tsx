import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Box,
  Flex,
  Spinner,
  Text,
  Icon,
  Heading,
  Image,
  Code,
  Badge,
  Link,
  Button,
  useDisclosure,
  IconButton,
  HStack,
  useColorModeValue,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  FaTimesCircle,
  FaUpload,
} from "react-icons/fa"
import { MdEdit } from "react-icons/md"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { BsFiletypeYml } from "react-icons/bs"
import { z } from "zod"

import { ProjectsService, type ContentsItem } from "../../../../../client"
import UploadFile from "../../../../../components/Files/UploadFile"
import EditFileInfo from "../../../../../components/Files/EditFileInfo"
import Markdown from "../../../../../components/Common/Markdown"
import useAuth from "../../../../../hooks/useAuth"
import PageMenu from "../../../../../components/Common/PageMenu"

const fileSearchSchema = z.object({ path: z.string().catch("") })

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/files",
)({
  component: Files,
  validateSearch: (search) => fileSearchSchema.parse(search),
})

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

// Determine if a given path should be expanded based on whether or not it is
// a parent directory of the selected path
function pathShouldBeExpanded(path: string, selectedPath: string) {
  if (path === selectedPath) {
    return true
  }
  // From https://stackoverflow.com/a/42355848/2284865
  const parentTokens = path.split("/").filter((i) => i.length)
  const childTokens = selectedPath.split("/").filter((i) => i.length)
  return parentTokens.every((t, i) => childTokens[i] === t)
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
  const navigate = useNavigate({ from: Route.fullPath })
  const indent = level ? level : 0
  const [isExpanded, setIsExpanded] = useState(
    pathShouldBeExpanded(item.path, selectedPath),
  )
  const { userName, projectName } = Route.useParams()
  const { data } = useQuery({
    queryKey: ["projects", userName, projectName, "files", item.path],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: item.path,
      }),
    enabled: isExpanded,
  })
  const handleClick = () => {
    setIsExpanded(!isExpanded)
    setSelectedPath(item.path)
    navigate({ search: { path: item.path } })
  }

  if (Array.isArray(data)) {
    data.sort(sortByTypeAndName)
  }

  return (
    <>
      <Flex cursor="pointer" onClick={handleClick} ml={indent * 4}>
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

interface FileContentProps {
  item: ContentsItem
}

function FileContent({ item }: FileContentProps) {
  const name = item.name
  const content = item.content
  if (name.endsWith(".png")) {
    return (
      <Image
        src={content ? `data:image/png;base64,${content}` : String(item.url)}
        width={"100%"}
      />
    )
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return (
      <Image
        src={content ? `data:image/jpeg;base64,${content}` : String(item.url)}
        width={"100%"}
      />
    )
  }
  if (name.endsWith(".pdf")) {
    return (
      <embed
        height="100%"
        width="100%"
        type="application/pdf"
        src={
          content ? `data:application/pdf;base64,${content}` : String(item.url)
        }
      />
    )
  }
  if (name.endsWith(".md") && content) {
    return (
      <Box py={2} px={4} maxW={"750px"}>
        <Markdown>{atob(content)}</Markdown>
      </Box>
    )
  }
  return (
    <Code
      p={2}
      borderRadius="lg"
      display="block"
      whiteSpace="pre"
      height="82vh"
      overflowY="auto"
      maxW="685px"
      overflowX="auto"
    >
      {content ? String(atob(content)) : ""}
    </Code>
  )
}

interface FileLockProps {
  item: ContentsItem
  ownerName: string
  projectName: string
}

function FileLock({ item, ownerName, projectName }: FileLockProps) {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const createLockMutation = useMutation({
    mutationFn: () =>
      ProjectsService.postProjectFileLock({
        ownerName,
        projectName,
        requestBody: { path: item.path },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "files"],
      }),
  })
  const deleteLockMutation = useMutation({
    mutationFn: () =>
      ProjectsService.deleteProjectFileLock({
        ownerName,
        projectName,
        requestBody: { path: item.path },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "files"],
      }),
  })

  if (!item.lock) {
    if (item.type === "file") {
      return (
        <Flex mt={2}>
          <Button
            aria-label="Lock file"
            onClick={() => createLockMutation.mutate()}
            isLoading={createLockMutation.isPending}
          >
            <Icon mr={1} as={FaLock} /> Lock file for editing
          </Button>
        </Flex>
      )
    }
    return <></>
  }
  return (
    <Flex color="yellow.500" align="center" mt={2} py={2}>
      <Icon as={FaLock} mr={1} height={"13px"} />
      <Text fontWeight="bold">Locked by {item.lock.user_github_username}</Text>
      {item.lock.user_github_username === currentUser?.github_username ? (
        <>
          <IconButton
            aria-label="Clear file lock"
            icon={<FaTimesCircle />}
            height={"12px"}
            size={"20px"}
            borderRadius={3}
            bg="none"
            ml={1}
            color={"yellow.500"}
            onClick={() => deleteLockMutation.mutate()}
            isLoading={deleteLockMutation.isPending}
          />
        </>
      ) : (
        ""
      )}
    </Flex>
  )
}

interface SelectedItemProps {
  selectedItem: ContentsItem
  ownerName: string
  projectName: string
}

function SelectedItemInfo({
  selectedItem,
  ownerName,
  projectName,
}: SelectedItemProps) {
  const fileInfoModal = useDisclosure()
  const uploadNewVersionModal = useDisclosure()

  return (
    <Box minW="300px">
      <Text>Name: {selectedItem.name}</Text>
      {selectedItem.type ? <Text>Type: {selectedItem.type}</Text> : ""}
      {selectedItem.size ? <Text>Size: {selectedItem.size}</Text> : ""}
      <FileLock
        item={selectedItem}
        ownerName={ownerName}
        projectName={projectName}
      />
      {selectedItem.type === "file" && selectedItem.in_repo ? (
        <>
          <Button
            mt={2}
            onClick={uploadNewVersionModal.onOpen}
            isDisabled={Boolean(selectedItem.lock)}
          >
            <Icon as={FaUpload} mr={1} />
            Upload new version
          </Button>
          <UploadFile
            onClose={uploadNewVersionModal.onClose}
            isOpen={uploadNewVersionModal.isOpen}
            path={selectedItem.path}
          />
        </>
      ) : (
        ""
      )}
      <HStack alignContent={"center"} mt={4} mb={1} gap={1}>
        <Heading size={"sm"}>Artifact info</Heading>
        <IconButton
          aria-label="Change artifact info"
          icon={<MdEdit />}
          height={"19px"}
          size={"22px"}
          width={"18px"}
          borderRadius={3}
          fontSize="15px"
          onClick={fileInfoModal.onOpen}
        />
        <EditFileInfo
          isOpen={fileInfoModal.isOpen}
          onClose={fileInfoModal.onClose}
          item={selectedItem}
        />
      </HStack>
      <Text>
        Type:
        {selectedItem.calkit_object?.kind ? (
          <>
            <Badge ml={1} bgColor="green.500">
              {String(selectedItem.calkit_object.kind)}
            </Badge>
          </>
        ) : (
          <Badge ml={1} bgColor="gray">
            None
          </Badge>
        )}
      </Text>
      {selectedItem.calkit_object?.name ? (
        <Text>Name: {String(selectedItem.calkit_object.name)}</Text>
      ) : (
        ""
      )}
      {selectedItem.calkit_object?.title ? (
        <Text>Title: {String(selectedItem.calkit_object.title)}</Text>
      ) : (
        ""
      )}
      {selectedItem.calkit_object?.description ? (
        <Text>
          Description: {String(selectedItem.calkit_object.description)}
        </Text>
      ) : (
        ""
      )}
      {selectedItem.calkit_object?.stage ? (
        <Text>
          Workflow stage:{" "}
          <Code>{String(selectedItem.calkit_object.stage)}</Code>
        </Text>
      ) : (
        ""
      )}
      {selectedItem.type === "file" && selectedItem.in_repo ? (
        <Link
          href={`https://github.dev/${ownerName}/${projectName}/blob/main/${selectedItem.path}`}
          isExternal
        >
          <Button mt={4}>
            Edit on GitHub.dev <Icon ml={1} as={ExternalLinkIcon} />
          </Button>
        </Link>
      ) : (
        ""
      )}
    </Box>
  )
}

function Files() {
  const { userName, projectName } = Route.useParams()
  const { path } = Route.useSearch()
  const {
    isPending: filesPending,
    data: files,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["projects", userName, projectName, "files"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const [selectedPath, setSelectedPath] = useState<string>(path)
  const selectedItemQuery = useQuery({
    queryKey: ["projects", userName, projectName, "files", selectedPath],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: selectedPath,
      }),
    enabled: selectedPath !== undefined,
  })
  const fileUploadModal = useDisclosure()
  if (Array.isArray(files?.dir_items)) {
    files.dir_items.sort(sortByTypeAndName)
  }
  const refresh = () => {
    refetch()
    selectedItemQuery.refetch()
  }

  return (
    <>
      {filesPending || isRefetching ? (
        <Flex justify="center" align="center" height="full" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          <PageMenu>
            <Flex gap={2}>
              <Heading size="md" mb={1}>
                All files
              </Heading>
              <IconButton
                variant="primary"
                height="25px"
                fontSize="sm"
                onClick={fileUploadModal.onOpen}
                icon={<FaPlus />}
                aria-label="upload"
              />
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
          <Box minW={"685px"} borderRadius="lg" borderWidth={1}>
            {selectedPath !== undefined &&
            (selectedItemQuery.isPending || selectedItemQuery.isRefetching) ? (
              <Flex justify="center" align="center" height="full" width="full">
                <Spinner size="xl" color="ui.main" />
              </Flex>
            ) : (
              <>
                {selectedItemQuery?.data?.content ||
                selectedItemQuery?.data?.url ? (
                  <FileContent item={selectedItemQuery?.data} />
                ) : (
                  ""
                )}
              </>
            )}
          </Box>
          <Box mx={5}>
            <Heading size="md">Info</Heading>
            {selectedPath !== undefined &&
            (selectedItemQuery.isPending || selectedItemQuery.isRefetching) ? (
              ""
            ) : (
              <>
                {selectedItemQuery?.data && selectedPath !== undefined ? (
                  <SelectedItemInfo
                    selectedItem={selectedItemQuery.data}
                    ownerName={userName}
                    projectName={projectName}
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
