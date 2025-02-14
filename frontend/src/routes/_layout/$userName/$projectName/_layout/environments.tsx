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
  Icon,
  Button,
  useDisclosure,
  Link,
  Alert,
  AlertIcon,
} from "@chakra-ui/react"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { FaCube, FaDocker } from "react-icons/fa"
import { AiOutlinePython } from "react-icons/ai"
import { SiAnaconda } from "react-icons/si"

import { useProjectEnvironments } from "../../../../../hooks/useProject"
import ViewEnvironment from "../../../../../components/Environments/ViewEnvironment"
import { Environment } from "../../../../../client"

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

interface EnvCardProps {
  environment: Environment
}

const EnvCard = ({ environment }: EnvCardProps) => {
  const viewEnvModal = useDisclosure()
  const reuseEnvModal = useDisclosure()
  return (
    <>
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
        {environment.all_attrs.image ? (
          <Text mb={1}>
            <strong>Image:</strong>{" "}
            <Code>{environment.all_attrs.image as String}</Code>
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
        <Flex mt={1.5}>
          <Button
            variant="primary"
            size="xs"
            mr={2}
            onClick={viewEnvModal.onOpen}
          >
            View
          </Button>
          <Button variant="primary" size="xs" onClick={reuseEnvModal.onOpen}>
            Reuse
          </Button>
          <ViewEnvironment
            environment={environment}
            isOpen={viewEnvModal.isOpen}
            onClose={viewEnvModal.onClose}
          />
        </Flex>
      </Card>
    </>
  )
}

function ProjectEnvsView() {
  const { userName, projectName } = Route.useParams()
  const { environmentsRequest } = useProjectEnvironments(userName, projectName)
  const { isPending: environmentsPending, data: environments } =
    environmentsRequest

  return (
    <>
      <Flex align="center" mb={2}>
        <Heading size="md">Environments</Heading>
      </Flex>
      {environmentsPending ? (
        <Flex justify="center" align="center" height={"100vh"} width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : environments?.length ? (
        <Box>
          <SimpleGrid columns={[2, null, 3]} gap={6}>
            {environments?.map((environment) => (
              <EnvCard environment={environment} />
            ))}
          </SimpleGrid>
        </Box>
      ) : (
        <Alert mt={2} status="warning" borderRadius="xl">
          <AlertIcon />
          This project has no environments defined.
        </Alert>
      )}
    </>
  )
}

function ProjectEnvs() {
  return <ProjectEnvsView />
}
