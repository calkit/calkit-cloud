import {
  Code,
  Box,
  Text,
  Heading,
  Button,
  Spinner,
  Flex,
  Icon,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"
import { FiExternalLink } from "react-icons/fi"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/local",
)({
  component: LocalServer,
})

function LocalServer() {
  const { userName, projectName } = Route.useParams()
  const localServerQuery = useQuery({
    queryKey: ["local-server", userName, projectName],
    queryFn: () =>
      axios.get(`http://localhost:8866/projects/${userName}/${projectName}`),
    retry: false,
  })
  const openVSCode = () => {
    axios.post(
      `http://localhost:8866/projects/${userName}/${projectName}/open/vscode`,
    )
  }
  const runGitPull = () => {
    axios.post(
      `http://localhost:8866/projects/${userName}/${projectName}/git/pull`,
    )
  }

  return (
    <>
      <Box>
        <Heading size="md" mb={1}>
          Local machine
        </Heading>
        {localServerQuery.isPending ? (
          <Flex justify="center" align="center" height="100vh" width="full">
            <Spinner size="xl" color="ui.main" />
          </Flex>
        ) : (
          <Flex>
            {!localServerQuery.error ? (
              <Box>
                <Text>The local server is running.</Text>
                <Button m={2} variant="primary" onClick={openVSCode}>
                  Open in VSCode <Icon ml={1} as={FiExternalLink} />
                </Button>
                <Button m={2} variant="primary" onClick={runGitPull}>
                  Pull changes from cloud
                </Button>
              </Box>
            ) : (
              <Box>
                <Text>
                  Local server not connected. To connect your local machine, run{" "}
                  <Code>calkit server</Code> in a terminal.
                </Text>
              </Box>
            )}
          </Flex>
        )}
      </Box>
    </>
  )
}
