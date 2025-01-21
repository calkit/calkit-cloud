import {
  Badge,
  Box,
  Button,
  Flex,
  Text,
  Icon,
  Heading,
  useDisclosure,
  IconButton,
  HStack,
  Link,
  Code,
} from "@chakra-ui/react"
import { FaTimesCircle, FaUpload, FaLock } from "react-icons/fa"
import { MdEdit } from "react-icons/md"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { type ContentsItem } from "../../client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import EditFileInfo from "./EditFileInfo"
import useAuth from "../../hooks/useAuth"
import UploadFile from "./UploadFile"
import { ProjectsService } from "../../client"

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
  userHasWriteAccess: boolean
}

function SelectedItemInfo({
  selectedItem,
  ownerName,
  projectName,
  userHasWriteAccess,
}: SelectedItemProps) {
  const fileInfoModal = useDisclosure()
  const uploadNewVersionModal = useDisclosure()

  return (
    <Box minW="300px">
      <Text>Name: {selectedItem.name}</Text>
      {selectedItem.type ? <Text>Type: {selectedItem.type}</Text> : ""}
      {selectedItem.size ? <Text>Size: {selectedItem.size}</Text> : ""}
      {userHasWriteAccess ? (
        <FileLock
          item={selectedItem}
          ownerName={ownerName}
          projectName={projectName}
        />
      ) : (
        ""
      )}
      {selectedItem.type === "file" &&
      selectedItem.in_repo &&
      userHasWriteAccess ? (
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
        {userHasWriteAccess ? (
          <>
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
          </>
        ) : (
          ""
        )}
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
        <Text mt={1}>Name: {String(selectedItem.calkit_object.name)}</Text>
      ) : (
        ""
      )}
      {selectedItem.calkit_object?.title ? (
        <Text mt={1}>Title: {String(selectedItem.calkit_object.title)}</Text>
      ) : (
        ""
      )}
      {selectedItem.calkit_object?.description ? (
        <Text mt={1}>
          Description: {String(selectedItem.calkit_object.description)}
        </Text>
      ) : (
        ""
      )}
      {selectedItem.calkit_object?.stage ? (
        <Text mt={1}>
          Pipeline stage:{" "}
          <Code>{String(selectedItem.calkit_object.stage)}</Code>
        </Text>
      ) : (
        ""
      )}
      {selectedItem.type === "file" &&
      selectedItem.in_repo &&
      userHasWriteAccess ? (
        <Link
          href={`https://github.dev/${ownerName}/${projectName}/blob/main/${selectedItem.path}`}
          isExternal
        >
          <Button mt={3}>
            Edit on GitHub.dev <Icon ml={1} as={ExternalLinkIcon} />
          </Button>
        </Link>
      ) : (
        ""
      )}
    </Box>
  )
}

export default SelectedItemInfo
