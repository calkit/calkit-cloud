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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"
import { FiExternalLink } from "react-icons/fi"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/local",
)({
  component: LocalServer,
})

function LocalServer() {
  const queryClient = useQueryClient()
  const { userName, projectName } = Route.useParams()
  const localServerQuery = useQuery({
    queryKey: ["local-server-main", userName, projectName],
    queryFn: () =>
      axios.get(`http://localhost:8866/projects/${userName}/${projectName}`),
    retry: false,
  })
  const jupyterServerQuery = useQuery({
    queryKey: ["jupyter-server", userName, projectName],
    queryFn: () =>
      axios.get(
        `http://localhost:8866/projects/${userName}/${projectName}/jupyter-server`,
      ),
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
  const jupyterServerMutation = useMutation({
    mutationFn: () =>
      axios.get(
        `http://localhost:8866/projects/${userName}/${projectName}/jupyter-server`,
        { params: { autostart: true } },
      ),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["local-server", userName, projectName],
      })
      queryClient.invalidateQueries({
        queryKey: ["jupyter-server", userName, projectName],
      })
      jupyterServerQuery.refetch()
      queryClient.refetchQueries({
        queryKey: ["local-server", userName, projectName],
      })
    },
  })

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
                <Button
                  m={2}
                  variant="primary"
                  onClick={() => jupyterServerMutation.mutate()}
                  isDisabled={jupyterServerQuery.data?.data?.url}
                  isLoading={
                    jupyterServerQuery.isPending ||
                    jupyterServerMutation.isPending ||
                    jupyterServerQuery.isRefetching
                  }
                >
                  {!jupyterServerQuery.data?.data?.url
                    ? "Start Jupyter server"
                    : "Jupyter server running"}
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
