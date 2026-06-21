import {
  Button,
  Code,
  Flex,
  Icon,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  Spinner,
  Text,
  useDisclosure,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { FiChevronDown, FiChevronRight, FiFile, FiFolder } from "react-icons/fi"

import { ProjectsService } from "../../client"

interface PathPickerProps {
  ownerName: string
  projectName: string
  // Currently selected path; empty string means the whole project.
  value: string
  onChange: (path: string) => void
  // Whether a subfolder can be selected. Off by default: releasing a folder
  // implies zipping it (and DVC storage for internal releases), which the
  // backend doesn't do yet, so folders are browsable but not selectable.
  allowFolders?: boolean
}

// Parent directory of a path, e.g. "paper/figs/a.png" -> "paper/figs".
const dirname = (path: string) => {
  const i = path.lastIndexOf("/")
  return i === -1 ? "" : path.slice(0, i)
}

// Browsable selector for a file or folder within the project tree, so users
// pick a path instead of typing one. An empty selection is the whole project.
const PathPicker = ({
  ownerName,
  projectName,
  value,
  onChange,
  allowFolders = false,
}: PathPickerProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  // Directory currently being browsed; opens at the parent of the selection.
  const [dir, setDir] = useState("")
  const handleOpen = () => {
    setDir(dirname(value))
    onOpen()
  }
  const { data, isPending, isError } = useQuery({
    queryKey: ["projects", ownerName, projectName, "contents", dir],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName,
        projectName,
        path: dir || undefined,
      }),
    enabled: isOpen,
    retry: false,
  })
  const items = (data?.dir_items ?? []).slice().sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === "dir" ? -1 : 1
  })
  const segments = dir ? dir.split("/") : []
  const select = (path: string) => {
    onChange(path)
    onClose()
  }

  return (
    <Popover
      isOpen={isOpen}
      onOpen={handleOpen}
      onClose={onClose}
      placement="bottom-start"
      matchWidth
    >
      <PopoverTrigger>
        <Button
          variant="outline"
          w="full"
          justifyContent="space-between"
          rightIcon={<FiChevronDown />}
          fontWeight="normal"
        >
          {value ? (
            <Code bg="transparent" px={0}>
              {value}
            </Code>
          ) : (
            <Text color="gray.500">Whole project</Text>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent w="full">
        <PopoverArrow />
        <PopoverHeader>
          <Flex align="center" wrap="wrap" fontSize="sm">
            <Button
              variant="link"
              size="sm"
              onClick={() => setDir("")}
              fontWeight={dir ? "normal" : "semibold"}
            >
              Project root
            </Button>
            {segments.map((seg, i) => (
              <Flex align="center" key={segments.slice(0, i + 1).join("/")}>
                <Icon as={FiChevronRight} mx={1} color="gray.400" />
                <Button
                  variant="link"
                  size="sm"
                  fontWeight={i === segments.length - 1 ? "semibold" : "normal"}
                  onClick={() => setDir(segments.slice(0, i + 1).join("/"))}
                >
                  {seg}
                </Button>
              </Flex>
            ))}
          </Flex>
        </PopoverHeader>
        <PopoverBody maxH="240px" overflowY="auto" px={0}>
          {isPending ? (
            <Flex justify="center" py={4}>
              <Spinner size="sm" />
            </Flex>
          ) : isError ? (
            <Text px={3} py={2} fontSize="sm" color="red.500">
              Couldn't load this folder.
            </Text>
          ) : items.length === 0 ? (
            <Text px={3} py={2} fontSize="sm" color="gray.500">
              Empty folder.
            </Text>
          ) : (
            items.map((item) => (
              <Flex
                key={item.path}
                align="center"
                px={3}
                py={1.5}
                cursor="pointer"
                _hover={{ bg: "gray.100", _dark: { bg: "gray.700" } }}
                onClick={() =>
                  item.type === "dir" ? setDir(item.path) : select(item.path)
                }
              >
                <Icon
                  as={item.type === "dir" ? FiFolder : FiFile}
                  mr={2}
                  color={item.type === "dir" ? "blue.400" : "gray.400"}
                />
                <Text fontSize="sm" flex={1} noOfLines={1}>
                  {item.name}
                </Text>
                {item.type === "dir" && (
                  <Icon as={FiChevronRight} color="gray.400" />
                )}
              </Flex>
            ))
          )}
        </PopoverBody>
        <PopoverFooter display="flex" gap={2}>
          <Button size="sm" variant="outline" onClick={() => select("")}>
            Whole project
          </Button>
          {allowFolders && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => select(dir)}
              isDisabled={!dir}
            >
              Use this folder
            </Button>
          )}
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  )
}

export default PathPicker
