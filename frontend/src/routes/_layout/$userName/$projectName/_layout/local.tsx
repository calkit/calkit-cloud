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
  ListItem,
  UnorderedList,
  Badge,
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
  const openFolder = () => {
    axios.post(
      `http://localhost:8866/projects/${userName}/${projectName}/open/folder`,
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
  const commitsAhead = statusQuery.data?.data?.git.commits_ahead
  const commitsBehind = statusQuery.data?.data?.git.commits_behind
  const untrackedFiles = statusQuery.data?.data?.git.untracked
  const changedFiles = statusQuery.data?.data?.git.changed
  const stagedFiles = statusQuery.data?.data?.git.staged
  const pipelineUpToDate =
    JSON.stringify(statusQuery.data?.data?.dvc.pipeline) === "{}"
  const gitPushMutation = useMutation({
    mutationFn: () => {
      const url = `http://localhost:8866/projects/${userName}/${projectName}/git/push`
      return axios.post(url)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["local-server-main", userName, projectName, "status"],
      })
    },
  })
  const runPipelineMutation = useMutation({
    mutationFn: () => {
      const url = `http://localhost:8866/projects/${userName}/${projectName}/pipeline/runs`
      return axios.post(url)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["local-server-main", userName, projectName, "status"],
      })
    },
  })
  const pipelineQuery = useQuery({
    queryKey: ["local-server-main", userName, projectName, "pipeline"],
    queryFn: () =>
      axios.get(
        `http://localhost:8866/projects/${userName}/${projectName}/pipeline`,
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
              <Flex>
                <Heading size="md" mb={2} mr={1}>
                  Status
                </Heading>
                <IconButton
                  aria-label="refresh"
                  height="25px"
                  icon={<FaSync />}
                  onClick={() => statusQuery.refetch()}
                  isLoading={statusQuery.isRefetching}
                />
              </Flex>
              {localWorkingDir ? (
                <Text>
                  The repo is cloned locally in
                  <Link onClick={openFolder}>{localWorkingDir}</Link>.
                </Text>
              ) : (
                <Text>The repo has not yet been cloned to this machine.</Text>
              )}
              {!statusQuery.isPending && !statusQuery.error ? (
                <>
                  {commitsAhead ? (
                    <Flex alignItems="center">
                      <Text mr={1} color="yellow.500">
                        There are {commitsAhead} commits to push to Git remote.
                      </Text>
                      <Button
                        variant="primary"
                        size="xs"
                        aria-label="push"
                        onClick={() => gitPushMutation.mutate()}
                        isLoading={gitPushMutation.isPending}
                      >
                        Push
                      </Button>
                    </Flex>
                  ) : (
                    ""
                  )}
                  {commitsBehind ? (
                    <Flex alignItems="center">
                      <Text mr={1}>
                        There are {commitsBehind} commits to pull from Git
                        remote.
                      </Text>
                      <Button variant="primary" size="xs" aria-label="push">
                        Pull
                      </Button>
                    </Flex>
                  ) : (
                    ""
                  )}
                  {commitsAhead === 0 && commitsBehind === 0 ? (
                    <Text>Repo is synced with Git remote.</Text>
                  ) : (
                    ""
                  )}
                </>
              ) : (
                ""
              )}
              {/* Staged files */}
              <Flex alignItems="center" mb={1} mt={4}>
                <Heading size="sm" mr={1}>
                  Staged files
                </Heading>
                <Button size="xs" variant="primary">
                  Commit
                </Button>
              </Flex>
              {stagedFiles ? (
                <>
                  {stagedFiles.map((fpath: string) => (
                    <Flex key={fpath} alignItems="center" mb={1}>
                      <Text color="green.500" mr={1}>
                        {fpath}
                      </Text>
                    </Flex>
                  ))}
                </>
              ) : (
                ""
              )}
              {/* Untracked files */}
              <Heading size="sm" mb={1} mt={4}>
                Untracked files
              </Heading>
              {untrackedFiles ? (
                <>
                  {untrackedFiles.map((fpath: string) => (
                    <Flex key={fpath} alignItems="center" mb={1}>
                      <Text color="red.500" mr={1}>
                        {fpath}
                      </Text>
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() =>
                          console.log(`Adding and committing ${fpath}`)
                        }
                        mr={1}
                      >
                        Add
                      </Button>
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() =>
                          console.log(`Opening ignore modal for ${fpath}`)
                        }
                      >
                        Ignore
                      </Button>
                    </Flex>
                  ))}
                </>
              ) : (
                ""
              )}
              {/* Changed files */}
              <Heading size="sm" mb={1} mt={4}>
                Changed files [commit all] [discard all]
              </Heading>
              {changedFiles ? (
                <>
                  {changedFiles.map((fpath: string) => (
                    <Flex key={fpath} alignItems="center" mb={1}>
                      <Text color="red.500" mr={1}>
                        {fpath}
                      </Text>
                      <Button
                        variant="primary"
                        size="xs"
                        mr={1}
                        onClick={() => console.log(`Committing ${fpath}`)}
                      >
                        Commit
                      </Button>
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => console.log(`Checking out ${fpath}`)}
                      >
                        Discard
                      </Button>
                    </Flex>
                  ))}
                </>
              ) : (
                ""
              )}
              {/* Pipeline section of status */}
              <Flex mb={1} mt={4} alignItems="center">
                <Heading size="sm" mr={1}>
                  Pipeline
                </Heading>
                {!pipelineUpToDate ? (
                  <Flex alignItems="center">
                    <Badge color="yellow.500">Out-of-date</Badge>
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => runPipelineMutation.mutate()}
                      isLoading={runPipelineMutation.isPending}
                    >
                      Run
                    </Button>
                  </Flex>
                ) : (
                  <Badge color="green.500">Up-to-date</Badge>
                )}
              </Flex>
              {!pipelineQuery.error && pipelineQuery.data?.data ? (
                <>
                  <UnorderedList>
                    {Object.entries(pipelineQuery.data.data.stages).map(
                      ([k, _]) => (
                        <ListItem key={k}>
                          <Code>{k}</Code>
                        </ListItem>
                      ),
                    )}
                  </UnorderedList>
                </>
              ) : (
                ""
              )}
              <Text>+ Add a new stage</Text>
              <Text>Maybe the DAG can go here?</Text>
            </Box>
          </Flex>
        )}
      </Box>
    </>
  )
}
