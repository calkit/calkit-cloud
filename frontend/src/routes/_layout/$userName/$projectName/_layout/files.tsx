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
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiFolder, FiFile, FiDatabase } from "react-icons/fi"
import { FaMarkdown, FaPlus } from "react-icons/fa6"
import { AiOutlinePython } from "react-icons/ai"
import { SiAnaconda, SiJupyter } from "react-icons/si"
import { useState } from "react"
import {
  FaDocker,
  FaList,
  FaRegFileImage,
  FaRegFolderOpen,
} from "react-icons/fa"
import { MdEdit } from "react-icons/md"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { z } from "zod"

import { ProjectsService, type ContentsItem } from "../../../../../client"
import { BsFiletypeYml } from "react-icons/bs"
import UploadFile from "../../../../../components/Files/UploadFile"
import EditFileInfo from "../../../../../components/Files/EditFileInfo"
import Markdown from "../../../../../components/Common/Markdown"

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
      <Flex cursor={"pointer"} onClick={handleClick} ml={indent * 4}>
        <Icon
          as={getIcon(item, isExpanded)}
          alignSelf="center"
          mr={1}
          color={item.calkit_object ? "green.500" : "default"}
        />
        <Text>{item.name}</Text>
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
  name: string
  content: string
}

function FileContent({ name, content }: FileContentProps) {
  if (name.endsWith(".png")) {
    return <Image src={`data:image/png;base64,${content}`} width={"100%"} />
  }
  if (name.endsWith(".pdf")) {
    return (
      <embed
        height="100%"
        width="100%"
        src={`data:application/pdf;base64,${content}`}
      />
    )
  }
  if (name.endsWith(".md")) {
    return (
      <Box py={2} px={4} maxW={"750px"}>
        <Markdown>{atob(content)}</Markdown>
      </Box>
    )
  }
  return (
    <Code
      p={2}
      borderRadius={"lg"}
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

  return (
    <Box>
      <Text>Name: {selectedItem.name}</Text>
      {selectedItem.type ? <Text>Type: {selectedItem.type}</Text> : ""}
      {selectedItem.size ? <Text>Size: {selectedItem.size}</Text> : ""}
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
          <Badge ml={1} bgColor={"gray"}>
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
  const { isPending: filesPending, data: files } = useQuery({
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

  return (
    <>
      {filesPending ? (
        <Flex justify="center" align="center" height="full" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          <Box
            mr={10}
            height="82vh"
            minW="200px"
            maxW="300px"
            overflowX="auto"
            overflowY="auto"
          >
            {" "}
            <Flex gap={2}>
              <Heading size="md" mb={1}>
                All files
              </Heading>
              <Button
                variant="primary"
                height="25px"
                p={3}
                pl={2}
                fontSize={"sm"}
                mb={1}
                onClick={fileUploadModal.onOpen}
              >
                <Icon as={FaPlus} height={"14px"} />
                Upload
              </Button>
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
          </Box>
          <Box minW={"685px"} borderRadius={"lg"} borderWidth={1}>
            {selectedPath !== undefined &&
            (selectedItemQuery.isPending || selectedItemQuery.isRefetching) ? (
              <Flex justify="center" align="center" height="full" width="full">
                <Spinner size="xl" color="ui.main" />
              </Flex>
            ) : (
              <>
                {selectedItemQuery?.data?.content ? (
                  <FileContent
                    name={selectedItemQuery?.data?.name}
                    content={selectedItemQuery?.data?.content}
                  />
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
