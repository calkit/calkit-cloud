import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Code,
  Badge,
  SimpleGrid,
  Card,
  Menu,
  MenuButton,
  Icon,
  MenuList,
  MenuItem,
  Button,
  useDisclosure,
  Link,
} from "@chakra-ui/react"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { FaPlus } from "react-icons/fa"

import useProject, {
  useProjectEnvironments,
} from "../../../../../hooks/useProject"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/environments",
)({
  component: ProjectEnvs,
})

function ProjectEnvsView() {
  const { userName, projectName } = Route.useParams()
  const { userHasWriteAccess } = useProject(userName, projectName)
  const { environmentsRequest } = useProjectEnvironments(userName, projectName)
  const { isPending: environmentsPending, data: environments } =
    environmentsRequest
  const uploadDataModal = useDisclosure()
  const labelDataModal = useDisclosure()

  return (
    <>
      <Flex align="center" mb={2}>
        <Heading size="md">Environments</Heading>
        {userHasWriteAccess ? (
          <>
            <Menu>
              <MenuButton
                as={Button}
                variant="primary"
                height={"25px"}
                width={"9px"}
                px={1}
                ml={2}
              >
                <Icon as={FaPlus} fontSize="xs" />
              </MenuButton>
              <MenuList>
                <MenuItem onClick={uploadDataModal.onOpen}>
                  Upload new dataset
                </MenuItem>
                <MenuItem onClick={labelDataModal.onOpen}>
                  Label existing file or folder as dataset
                </MenuItem>
              </MenuList>
            </Menu>
          </>
        ) : (
          ""
        )}
      </Flex>
      {environmentsPending ? (
        <Flex justify="center" align="center" height={"100vh"} width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <SimpleGrid columns={[3, null, 4]} gap={6}>
            {environments?.map((environment) => (
              <Card key={environment.name} p={6} variant="elevated">
                <Heading size="sm" mb={2}>
                  <Code p={1} maxW="100%">
                    <Link
                      as={RouterLink}
                      to={"../files"}
                      search={{ path: environment.path } as any}
                    >
                      {environment.name}
                    </Link>
                    {environment.imported_from ? (
                      <Badge ml={1} bgColor="green.500">
                        imported
                      </Badge>
                    ) : (
                      ""
                    )}
                  </Code>
                </Heading>
                {environment.kind ? (
                  <Text mb={1}>
                    <strong>Kind:</strong> {environment.kind}
                  </Text>
                ) : (
                  ""
                )}
                {environment.path ? (
                  <Text mb={1}>
                    <strong>Path:</strong> {environment.path}
                  </Text>
                ) : (
                  ""
                )}
                {environment.description ? (
                  <Text>
                    <strong>Description:</strong> {environment.description}
                  </Text>
                ) : (
                  ""
                )}
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </>
  )
}

function ProjectEnvs() {
  return <ProjectEnvsView />
}
