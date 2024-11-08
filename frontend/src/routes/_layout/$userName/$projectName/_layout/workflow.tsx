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
import { useState } from "react"

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
  const [isDiagramExpanded, setIsDiagramExpanded] = useState(false)

  return (
    <>
      {pipelineQuery.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex flexDir={isDiagramExpanded ? "column" : "row"}>
          {pipelineQuery.data ? (
            <>
              <Box
                px={isDiagramExpanded ? 0 : 5}
                py={isDiagramExpanded ? 0 : 10}
                maxW={isDiagramExpanded ? "100%" : "50%"}
                minW="40%"
              >
                <Mermaid
                  isDiagramExpanded={isDiagramExpanded}
                  setIsDiagramExpanded={setIsDiagramExpanded}
                >
                  {String(pipelineQuery?.data?.mermaid)}
                </Mermaid>
              </Box>
              <Box width={isDiagramExpanded ? "100%" : "680px"}>
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
              <AlertIcon />A pipeline has not yet been defined for this project.
              To create one, add stages to the <Code mx={1}>dvc.yaml</Code>{" "}
              file.
            </Alert>
          )}
        </Flex>
      )}
    </>
  )
}
