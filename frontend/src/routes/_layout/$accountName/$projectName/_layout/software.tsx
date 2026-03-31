import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Code,
  Flex,
  Heading,
  Link,
  Spinner,
  Text,
  useDisclosure,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import { ProjectsService } from "../../../../../client"
import type { Environment } from "../../../../../client"
import ViewEnvironment from "../../../../../components/Environments/ViewEnvironment"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/software",
)({
  component: ProjectSoftware,
})

function EnvironmentCard({ environment }: { environment: Environment }) {
  const modal = useDisclosure()

  return (
    <>
      <Box borderWidth={1} borderRadius="lg" p={4}>
        <Flex align="center" justify="space-between" mb={1}>
          <Heading size="sm">
            <Code fontSize="sm">{environment.name}</Code>
          </Heading>
          {environment.file_content && (
            <Button size="xs" onClick={modal.onOpen}>
              View file
            </Button>
          )}
        </Flex>
        {environment.path && (
          <Text fontSize="sm" color="gray.500">
            {environment.path}
          </Text>
        )}
        {environment.description && (
          <Text fontSize="sm" mt={1}>
            {environment.description}
          </Text>
        )}
      </Box>
      {environment.file_content && (
        <ViewEnvironment
          environment={environment}
          isOpen={modal.isOpen}
          onClose={modal.onClose}
        />
      )}
    </>
  )
}

function ProjectSoftware() {
  const { accountName, projectName } = Route.useParams()
  const softwareQuery = useQuery({
    queryKey: ["projects", accountName, projectName, "software"],
    queryFn: () =>
      ProjectsService.getProjectSoftware({
        ownerName: accountName,
        projectName,
      }),
  })

  const environments = softwareQuery.data?.environments ?? []

  return (
    <>
      {softwareQuery.isPending ? (
        <LoadingSpinner />
      ) : environments.length === 0 ? (
        <Alert mt={2} status="warning" borderRadius="xl">
          <AlertIcon />
          No software has been declared as being created in this project. See
          the{" "}
          <Link
            ml={1}
            isExternal
            variant="blue"
            href="https://docs.calkit.org/software/"
          >
            documentation
          </Link>{" "}
          for more information.
        </Alert>
      ) : (
        <Box>
          <Heading size="md" mb={4}>
            Environments
          </Heading>
          <Flex direction="column" gap={3}>
            {environments.map((env) => (
              <EnvironmentCard key={env.name} environment={env} />
            ))}
          </Flex>
        </Box>
      )}
    </>
  )
}
