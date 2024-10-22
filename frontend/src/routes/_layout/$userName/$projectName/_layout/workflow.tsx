import { createFileRoute } from "@tanstack/react-router"
import {
  Box,
  Code,
  Flex,
  Spinner,
  Heading,
  Alert,
  AlertIcon,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"

import Mermaid from "../../../../../components/Common/Mermaid"
import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/workflow",
)({
  component: ProjectWorkflow,
})

function ProjectWorkflow() {
  const { userName, projectName } = Route.useParams()
  const pipelineQuery = useQuery({
    queryKey: [userName, projectName, "pipeline"],
    queryFn: () =>
      ProjectsService.getProjectPipeline({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {pipelineQuery.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          {pipelineQuery.data ? (
            <>
              <Box p={5} maxW="50%" minW="40%">
                <Mermaid>{String(pipelineQuery?.data?.mermaid)}</Mermaid>
              </Box>
              <Box width="680px">
                <Heading size="md" my={2}>
                  YAML
                </Heading>
                <Code
                  p={2}
                  borderRadius={"lg"}
                  display="block"
                  whiteSpace="pre"
                  height="80vh"
                  overflowY="auto"
                >
                  {String(pipelineQuery?.data?.yaml)}
                </Code>
              </Box>
            </>
          ) : (
            <Alert mt={2} status="warning" borderRadius="xl">
              <AlertIcon />A workflow has not yet been defined for this project.
              To create one, add stages to the <Code mx={1}>dvc.yaml</Code>{" "}
              file.
            </Alert>
          )}
        </Flex>
      )}
    </>
  )
}
