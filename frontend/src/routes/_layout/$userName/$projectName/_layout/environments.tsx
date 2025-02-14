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
import { FaCube, FaDocker, FaPlus } from "react-icons/fa"
import { AiOutlinePython } from "react-icons/ai"
import { SiAnaconda } from "react-icons/si"

import useProject, {
  useProjectEnvironments,
} from "../../../../../hooks/useProject"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/environments",
)({
  component: ProjectEnvs,
})

const getIcon = (envType: string) => {
  if (["uv", "uv-venv", "venv"].includes(envType)) {
    return AiOutlinePython
  }
  if (envType == "conda") {
    return SiAnaconda
  }
  if (envType == "docker") {
    return FaDocker
  }
  return FaCube
}

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
                <Flex alignItems="center" mb={2}>
                  <Icon as={getIcon(environment.kind)} mr={1} />
                  <Heading size="md">
                    <Code px={1} py={0.5} maxW="100%" fontSize="large">
                      {environment.name}
                      {environment.imported_from ? (
                        <Badge ml={1} bgColor="green.500">
                          imported
                        </Badge>
                      ) : (
                        ""
                      )}
                    </Code>
                  </Heading>
                </Flex>
                {environment.kind ? (
                  <Text mb={1}>
                    <strong>Kind:</strong> <Code>{environment.kind}</Code>
                  </Text>
                ) : (
                  ""
                )}
                {environment.path ? (
                  <Text mb={1}>
                    <strong>Path:</strong>{" "}
                    <Code>
                      <Link
                        as={RouterLink}
                        to={"../files"}
                        search={{ path: environment.path } as any}
                      >
                        {environment.path}
                      </Link>
                    </Code>
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
