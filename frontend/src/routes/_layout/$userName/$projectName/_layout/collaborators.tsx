import {
  Box,
  Heading,
  SkeletonText,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Badge,
  Menu,
  MenuItem,
  MenuButton,
  Tr,
  useDisclosure,
  Button,
  MenuList,
} from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { FiTrash } from "react-icons/fi"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import Navbar from "../../../../../components/Common/Navbar"
import AddCollaborator from "../../../../../components/Projects/AddCollaborator"
import { ProjectsService } from "../../../../../client"
import useAuth from "../../../../../hooks/useAuth"
import Delete from "../../../../../components/Common/DeleteAlert"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/collaborators",
)({
  component: Collaborators,
})

interface ActionsMenuProps {
  ownerName: string
  projectName: string
  githubUsername: string
  disabled?: boolean
}

const ActionsMenu = ({
  ownerName,
  projectName,
  githubUsername,
  disabled,
}: ActionsMenuProps) => {
  const deleteModal = useDisclosure()

  return (
    <>
      <Menu>
        <MenuButton
          isDisabled={disabled}
          as={Button}
          rightIcon={<BsThreeDotsVertical />}
          variant="unstyled"
        />
        <MenuList>
          <MenuItem
            onClick={deleteModal.onOpen}
            icon={<FiTrash fontSize="16px" />}
            color="ui.danger"
          >
            Remove collaborator
          </MenuItem>
        </MenuList>
        <Delete
          type={"Collaborator"}
          id={githubUsername}
          projectOwner={ownerName}
          projectName={projectName}
          isOpen={deleteModal.isOpen}
          onClose={deleteModal.onClose}
        />
      </Menu>
    </>
  )
}

function Collaborators() {
  const { userName, projectName } = Route.useParams()
  const { user: currentUser } = useAuth()
  const { isPending, data: collaborators } = useQuery({
    queryKey: ["projects", userName, projectName, "collaborators"],
    queryFn: () =>
      ProjectsService.getProjectCollaborators({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <Box>
      <Heading size={"md"}>Collaborators</Heading>
      <Navbar type="collaborator" addModalAs={AddCollaborator} />
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th width="20%">Username</Th>
              <Th width="20%">Full name</Th>
              <Th width="50%">Email</Th>
              <Th width="10%">Access</Th>
              <Th width="10%">Actions</Th>
            </Tr>
          </Thead>
          {isPending ? (
            <Tbody>
              <Tr>
                {new Array(4).fill(null).map((_, index) => (
                  <Td key={index}>
                    <SkeletonText noOfLines={1} paddingBlock="16px" />
                  </Td>
                ))}
              </Tr>
            </Tbody>
          ) : (
            <Tbody>
              {collaborators?.map((collaborator) => (
                <Tr key={collaborator.github_username}>
                  <Td isTruncated maxWidth="150px">
                    {collaborator.github_username}
                  </Td>
                  <Td
                    color={!collaborator.full_name ? "ui.dim" : "inherit"}
                    isTruncated
                    maxWidth="150px"
                  >
                    {collaborator.full_name || "N/A"}
                    {currentUser?.id === collaborator.user_id && (
                      <Badge ml="1" colorScheme="teal">
                        You
                      </Badge>
                    )}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    {collaborator.email}
                  </Td>
                  <Td>{collaborator.access_level}</Td>
                  <Td>
                    <ActionsMenu
                      ownerName={userName}
                      projectName={projectName}
                      githubUsername={collaborator.github_username}
                      disabled={currentUser?.id === collaborator.user_id}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          )}
        </Table>
      </TableContainer>
    </Box>
  )
}
