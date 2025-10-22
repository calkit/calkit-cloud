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
} from "@chakra-ui/react"
import { createFileRoute, Outlet, notFound } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { FaGithub, FaQuestion, FaRegClone } from "react-icons/fa"
import { LuCopyPlus } from "react-icons/lu"
import { MdEdit } from "react-icons/md"
import { BsThreeDots } from "react-icons/bs"
import axios from "axios"
import mixpanel from "mixpanel-browser"

import Sidebar from "../../../../components/Common/Sidebar"
import { ProjectPublic } from "../../../../client"
import EditProject from "../../../../components/Projects/EditProject"
import useProject from "../../../../hooks/useProject"
import NewProject from "../../../../components/Projects/NewProject"
import useAuth from "../../../../hooks/useAuth"
import HelpContent from "../../../../components/Projects/HelpContent"
import CloneProject from "../../../../components/Projects/CloneProject"
import ProjectStatus from "../../../../components/Projects/ProjectStatus"
import MakeProjectPublic from "../../../../components/Projects/MakeProjectPublic"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout",
)({
  component: ProjectLayout,
})

interface ProjectMenuProps {
  project: ProjectPublic
  userHasWriteAccess: boolean
}

function ProjectMenu({ project, userHasWriteAccess }: ProjectMenuProps) {
  const { user } = useAuth()
  const editProjectModal = useDisclosure()
  const newProjectModal = useDisclosure()
  const cloneProjectModal = useDisclosure()

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
          <MenuItem
            icon={<FaRegClone fontSize={18} />}
            onClick={cloneProjectModal.onOpen}
          >
            Clone to local machine
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
      <CloneProject
        project={project}
        isOpen={cloneProjectModal.isOpen}
        onClose={cloneProjectModal.onClose}
      />
    </>
  )
}

function ProjectLayout() {
  const { accountName, projectName } = Route.useParams()
  const { projectRequest, userHasWriteAccess } = useProject(
    accountName,
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
    queryKey: ["local-server", accountName, projectName],
    queryFn: () =>
      axios.get(`http://localhost:8866/projects/${accountName}/${projectName}`),
    retry: false,
  })
  const titleSize = "lg"
  const onClickHelp = () => {
    mixpanel.track("Clicked project help button")
    helpDrawer.onOpen()
  }
  const projectStatusModal = useDisclosure()
  const projectPublicModal = useDisclosure()

  return (
    <>
      {isPending || localServerQuery.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          <Sidebar basePath={`/${accountName}/${projectName}`} />
          <Container maxW="full" mx={6} mb={10}>
            <Container
              maxW="100%"
              alignContent="center"
              alignItems="center"
              mt={5}
              mb={4}
              display="flex"
              flexWrap="wrap"
              px={0}
            >
              <Box maxW="100%" mr={2}>
                <Heading size={titleSize}>{project?.title}</Heading>
              </Box>
              {/* Public/private badge */}
              <Box mr={2} pb={0.5}>
                <Badge
                  color={project?.is_public ? "green.500" : "yellow.500"}
                  onClick={() => {
                    !project?.is_public ? projectPublicModal.onOpen() : null
                  }}
                  cursor={!project?.is_public ? "pointer" : "default"}
                >
                  {project?.is_public ? "Public" : "Private"}
                </Badge>
                {project && !project?.is_public ? (
                  <MakeProjectPublic
                    project={project}
                    isOpen={projectPublicModal.isOpen}
                    onClose={projectPublicModal.onClose}
                  />
                ) : (
                  ""
                )}
              </Box>
              {/* Status badge */}
              <Box mr={2} pb={0.5}>
                <Link>
                  <Badge
                    color={
                      project?.status === "in-progress"
                        ? "green.500"
                        : project?.status === "completed"
                          ? "blue.500"
                          : "gray.500"
                    }
                    onClick={projectStatusModal.onOpen}
                  >
                    {project?.status
                      ? project.status.replaceAll("-", " ")
                      : "no status"}
                  </Badge>
                </Link>
                {project ? (
                  <ProjectStatus
                    project={project}
                    isOpen={projectStatusModal.isOpen}
                    onClose={projectStatusModal.onClose}
                  />
                ) : (
                  ""
                )}
              </Box>
              {/* GitHub link */}
              {project?.git_repo_url ? (
                <Box mr={2}>
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
              <Box mr={2}>
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
                    onClick={onClickHelp}
                    icon={<FaQuestion />}
                  />
                </Flex>
              </Box>
              <Box>
                {project?.description ? (
                  <Text fontSize="small">→ {project.description}</Text>
                ) : (
                  ""
                )}
              </Box>
            </Container>
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
                <HelpContent userHasWriteAccess={userHasWriteAccess} />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </Flex>
      )}
    </>
  )
}
