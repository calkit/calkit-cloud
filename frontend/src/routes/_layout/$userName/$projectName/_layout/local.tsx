import {
  Code,
  Box,
  Text,
  Heading,
  Button,
  Spinner,
  Flex,
  Icon,
  Link,
  IconButton,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"
import { FiExternalLink } from "react-icons/fi"
import { FaSync } from "react-icons/fa"

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
    mutationFn: () => {
      const url = `http://localhost:8866/projects/${userName}/${projectName}/jupyter-server`
      if (!jupyterServerQuery.data?.data?.url) {
        return axios.get(url, { params: { autostart: true, no_browser: true } })
      }
      return axios.delete(url)
    },
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
  const localWorkingDir = localServerQuery.data?.data?.wdir
  const statusQuery = useQuery({
    queryKey: ["local-server-main", userName, projectName, "status"],
    queryFn: () =>
      axios.get(
        `http://localhost:8866/projects/${userName}/${projectName}/status`,
      ),
    retry: false,
  })

  return (
    <>
      <Box mr={4}>
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
              <Box mr={4} width="60%">
                <Text>The local server is running. [search for command]</Text>
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
                  isLoading={
                    jupyterServerQuery.isPending ||
                    jupyterServerMutation.isPending ||
                    jupyterServerQuery.isRefetching
                  }
                >
                  {!jupyterServerQuery.data?.data?.url
                    ? "Start Jupyter server"
                    : "Stop Jupyter server"}
                </Button>
                {jupyterServerQuery.data?.data?.url ? (
                  <Link isExternal href={jupyterServerQuery.data?.data.url}>
                    <Button variant="primary" m={2}>
                      Open JupyterLab <Icon ml={1} as={FiExternalLink} />
                    </Button>
                  </Link>
                ) : (
                  ""
                )}
                <Box
                  borderRadius="lg"
                  borderWidth={1}
                  p={2}
                  mt={4}
                  minH="400px"
                >
                  $ This is a fake terminal.
                </Box>
              </Box>
            ) : (
              <Box>
                <Text>
                  Local server not connected. To connect your local machine, run{" "}
                  <Code>calkit server</Code> in a terminal.
                </Text>
              </Box>
            )}
            {/* Right hand side status box */}
            <Box
              borderRadius="lg"
              borderWidth={1}
              width="40%"
              p={4}
              height="80vh"
            >
              <Heading size="md" mb={2}>
                Status
                <IconButton
                  aria-label="refresh"
                  height="25px"
                  icon={<FaSync />}
                  onClick={() => console.log("refreshing")}
                />
              </Heading>
              {localWorkingDir ? (
                <Text>The repo is cloned locally in {localWorkingDir}.</Text>
              ) : (
                <Text>The repo has not yet been cloned to this machine.</Text>
              )}
              {!statusQuery.error ? (
                <>
                  {statusQuery.data?.data?.git.commits_ahead ? (
                    <Text>There are commits to push to Git remote.</Text>
                  ) : (
                    ""
                  )}
                  {statusQuery.data?.data?.git.commits_behind ? (
                    <Text>There are commits to pull from Git remote.</Text>
                  ) : (
                    ""
                  )}
                  {statusQuery.data?.data?.git.commits_ahead === 0 &&
                  statusQuery.data?.data?.git.commits_behind === 0 ? (
                    <Text>Repo is synced with Git remote.</Text>
                  ) : (
                    ""
                  )}
                </>
              ) : (
                ""
              )}
              <Heading size="sm" mb={1} mt={4}>
                Untracked files
              </Heading>
              <Text color="red.500">data.xlsx [add]</Text>
              <Heading size="sm" mb={1} mt={4}>
                Changed files
              </Heading>
              <Text color="red.500">README.md [commit]</Text>
              <Heading size="sm" mb={1} mt={4}>
                Pipeline
              </Heading>
              <Text color="yellow.500">
                Pipeline is out-of-date and needs to be run. [run]
              </Text>
              <Code>this-is-the-first-stage</Code>
              <Text>+ Add a new stage</Text>
              <Text>Maybe the DAG can go here?</Text>
            </Box>
          </Flex>
        )}
      </Box>
    </>
  )
}
