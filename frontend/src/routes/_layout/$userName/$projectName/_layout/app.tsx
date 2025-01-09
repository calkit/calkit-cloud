import { createFileRoute } from "@tanstack/react-router"
import { Code, Flex, Spinner, Alert, AlertIcon } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"

import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/app",
)({
  component: ProjectApp,
})

function ProjectApp() {
  const { userName, projectName } = Route.useParams()
  const appQuery = useQuery({
    queryKey: [userName, projectName, "app"],
    queryFn: () =>
      ProjectsService.getProjectPipeline({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {appQuery.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          {appQuery.data ? (
            <>App goes here</>
          ) : (
            <Alert mt={2} status="warning" borderRadius="xl">
              <AlertIcon />
              An app has not yet been defined for this project. To add one,
              modify the <Code>app</Code> object in the project's{" "}
              <Code>calkit.yaml</Code> file.
            </Alert>
          )}
        </Flex>
      )}
    </>
  )
}
