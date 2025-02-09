import {
  Container,
  Flex,
  Spinner,
  Heading,
  Link,
  Icon,
  Drawer,
  IconButton,
  useDisclosure,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  Text,
  Badge,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Box,
  Tooltip,
} from "@chakra-ui/react"
import {
  createFileRoute,
  Outlet,
  notFound,
} from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { FaGithub, FaQuestion } from "react-icons/fa"
import { LuCopyPlus } from "react-icons/lu"
import { MdEdit } from "react-icons/md"
import { BsThreeDots } from "react-icons/bs"
import axios from "axios"

import Sidebar from "../../../../components/Common/Sidebar"
import { ProjectPublic } from "../../../../client"
import EditProject from "../../../../components/Projects/EditProject"
import useProject from "../../../../hooks/useProject"
import NewProject from "../../../../components/Projects/NewProject"
import useAuth from "../../../../hooks/useAuth"
import HelpContent from "../../../../components/Projects/HelpContent"

export const Route = createFileRoute("/_layout/$userName/$projectName/_layout")(
  {
    component: ProjectLayout,
  },
)

interface ProjectMenuProps {
  project: ProjectPublic
  userHasWriteAccess: boolean
}

function ProjectMenu({ project, userHasWriteAccess }: ProjectMenuProps) {
  const { user } = useAuth()
  const editProjectModal = useDisclosure()
  const newProjectModal = useDisclosure()

  return (
    <>
      <Menu>
        <MenuButton
          as={IconButton}
          icon={<BsThreeDots />}
          size="xs"
          mr={1}
        ></MenuButton>
        <MenuList>
          <MenuItem
            icon={<MdEdit fontSize={18} />}
            onClick={editProjectModal.onOpen}
            isDisabled={!userHasWriteAccess}
          >
            Edit title or description
          </MenuItem>
          <MenuItem
            icon={<LuCopyPlus fontSize={18} />}
            onClick={newProjectModal.onOpen}
            isDisabled={!user}
          >
            Use this project as a template
          </MenuItem>
        </MenuList>
      </Menu>
      <EditProject
        project={project}
        isOpen={editProjectModal.isOpen}
        onClose={editProjectModal.onClose}
      />
      <NewProject
        isOpen={newProjectModal.isOpen}
        onClose={newProjectModal.onClose}
        defaultTemplate={`${project.owner_account_name}/${project.name}`}
      />
    </>
  )
}

function ProjectLayout() {
  const { userName, projectName } = Route.useParams()
  const { projectRequest, userHasWriteAccess } = useProject(
    userName,
    projectName,
  )
  const isPending = projectRequest.isPending
  const error = projectRequest.error
  const project = projectRequest.data
  if (error?.message === "Not Found" || error?.message === "Forbidden") {
    throw notFound()
  }
  const helpDrawer = useDisclosure()
  const localServerQuery = useQuery({
    queryKey: ["local-server", userName, projectName],
    queryFn: () =>
      axios.get(`http://localhost:8866/projects/${userName}/${projectName}`),
    retry: false,
  })
  const titleSize = String(project?.title).length < 60 ? "lg" : "md"

  return (
    <>
      {isPending || localServerQuery.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          <Sidebar basePath={`/${userName}/${projectName}`} />
          <Container maxW="full" mx={6} mb={10}>
            <Flex
              width={"full"}
              alignContent="center"
              alignItems="center"
              mt={5}
              mb={4}
            >
              <Box maxW="80%">
                <Heading size={titleSize}>{project?.title}</Heading>
              </Box>
              <Box mx={2} pb={0.5}>
                <Badge color={project?.is_public ? "green.500" : "yellow.500"}>
                  {project?.is_public ? "Public" : "Private"}
                </Badge>
              </Box>
              {project?.git_repo_url ? (
                <Box>
                  <Link href={project?.git_repo_url} isExternal>
                    <Flex alignItems="center">
                      <Icon as={FaGithub} pt={0.5} />
                      <Icon as={ExternalLinkIcon} />
                    </Flex>
                  </Link>
                </Box>
              ) : (
                ""
              )}
              <Box ml={2}>
                <Flex>
                  {project ? (
                    <ProjectMenu
                      project={project}
                      userHasWriteAccess={userHasWriteAccess}
                    />
                  ) : (
                    ""
                  )}
                  <IconButton
                    isRound
                    aria-label="Open help"
                    size={"xs"}
                    onClick={helpDrawer.onOpen}
                    icon={<FaQuestion />}
                  />
                </Flex>
              </Box>
              <Box ml={2} maxW="30%">
                {project?.description ? (
                  <Tooltip openDelay={600} label={project.description}>
                    <Text fontSize="small" isTruncated>
                      → {project.description}
                    </Text>
                  </Tooltip>
                ) : (
                  ""
                )}
              </Box>
            </Flex>
            <Outlet />
          </Container>
          <Drawer
            isOpen={helpDrawer.isOpen}
            onClose={helpDrawer.onClose}
            placement="right"
            size="sm"
          >
            <DrawerOverlay />
            <DrawerContent>
              <DrawerCloseButton />
              <DrawerHeader>Help</DrawerHeader>
              <DrawerBody>
                <HelpContent />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </Flex>
      )}
    </>
  )
}
