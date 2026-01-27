import { createFileRoute } from "@tanstack/react-router"
import {
  Box,
  Code,
  Flex,
  Spinner,
  Heading,
  Alert,
  AlertIcon,
  Link,
} from "@/chakra"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import Mermaid from "../../../../../components/Common/Mermaid"
import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/pipeline",
)({
  component: ProjectPipeline,
})

function ProjectPipeline() {
  const { accountName, projectName } = Route.useParams()
  const pipelineQuery = useQuery({
    queryKey: [accountName, projectName, "pipeline"],
    queryFn: () =>
      ProjectsService.getProjectPipeline({
        ownerName: accountName,
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
                {pipelineQuery?.data?.calkit_yaml ? (
                  <>
                    <Heading size="md" my={2}>
                      Pipeline (from <Code fontSize="lg">calkit.yaml</Code>)
                    </Heading>
                    <Code
                      p={2}
                      borderRadius={"lg"}
                      display="block"
                      whiteSpace="pre"
                      height="80vh"
                      overflowY="auto"
                    >
                      {String(pipelineQuery?.data?.calkit_yaml)}
                    </Code>
                  </>
                ) : (
                  <>
                    <Heading size="md" my={2}>
                      Pipeline (from <Code fontSize="lg">dvc.yaml</Code>)
                    </Heading>
                    <Code
                      p={2}
                      borderRadius={"lg"}
                      display="block"
                      whiteSpace="pre"
                      height="80vh"
                      overflowY="auto"
                    >
                      {String(pipelineQuery?.data?.dvc_yaml)}
                    </Code>
                  </>
                )}
              </Box>
            </>
          ) : (
            <Alert mt={2} status="warning" borderRadius="xl">
              <AlertIcon />A pipeline has not yet been defined for this project.
              To create one, see the{" "}
              <Link
                ml={1}
                isExternal
                variant="blue"
                href="https://docs.calkit.org/pipeline/"
              >
                pipeline documentation
              </Link>
              .
            </Alert>
          )}
        </Flex>
      )}
    </>
  )
}
