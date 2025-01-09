import { createFileRoute } from "@tanstack/react-router"
import { Box, Code, Flex, Spinner, Alert, AlertIcon } from "@chakra-ui/react"
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
      ProjectsService.getProjectApp({
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
          {appQuery.data?.url ? (
            <>
              <Box width="100%" height="80vh" mt={2} pb={8} mb={4}>
                <iframe
                  title="app"
                  src={appQuery.data.url}
                  width="100%"
                  height="100%"
                  style={{ borderRadius: "10px" }}
                />
              </Box>
            </>
          ) : (
            <Alert mt={2} status="warning" borderRadius="xl">
              <AlertIcon />
              An app has not yet been defined for this project. To add one,
              modify the <Code mx={1}>app</Code>object in the project's{" "}
              <Code mx={1}>calkit.yaml</Code> file.
            </Alert>
          )}
        </Flex>
      )}
    </>
  )
}
