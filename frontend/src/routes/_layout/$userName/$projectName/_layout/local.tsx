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
  useDisclosure,
  Checkbox,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"
import { FiExternalLink } from "react-icons/fi"
import { FaPlus, FaSync } from "react-icons/fa"

import { type ProjectPublic } from "../../../../../client"
import NewStage from "../../../../../components/Local/NewStage"
import AddPath from "../../../../../components/Local/AddPath"
import IgnorePath from "../../../../../components/Local/IgnorePath"
import useCustomToast from "../../../../../hooks/useCustomToast"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/local",
)({
  component: LocalServer,
})

function LocalServer() {
  const queryClient = useQueryClient()
  const { userName, projectName } = Route.useParams()
  const project = queryClient.getQueryData<ProjectPublic>([
    "projects",
    userName,
    projectName,
  ])
  const localServerRunningQuery = useQuery({
    queryKey: ["local-server-main"],
    queryFn: () => axios.get("http://localhost:8866/health"),
    retry: false,
  })
  const localServerRunning = localServerRunningQuery.data?.data === "All good!"
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
  const dvcNeedsPull = statusQuery.data?.data?.dvc.data.not_in_cache.length > 0
  const dvcNeedsPush = statusQuery.data?.data?.dvc.data.not_in_remote.length > 0
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
  const showToast = useCustomToast()
  const runPipelineMutation = useMutation({
    mutationFn: () => {
      const url = `http://localhost:8866/projects/${userName}/${projectName}/pipeline/runs`
      return axios.post(url)
    },
    onError: (err: any) => {
      showToast("Error", String(err.response.data.detail), "error")
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
  const cloneMutation = useMutation({
    mutationFn: () => {
      const url = "http://localhost:8866/calkit/clone"
      const data = { git_repo_url: project?.git_repo_url }
      return axios.post(url, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["local-server-main", userName, projectName, "status"],
      })
      queryClient.invalidateQueries({
        queryKey: ["local-server-main", userName, projectName, "pipeline"],
      })
      queryClient.invalidateQueries({
        queryKey: ["local-server", userName, projectName],
      })
      queryClient.invalidateQueries({
        queryKey: ["local-server-main", userName, projectName],
      })
    },
  })
  const newStageModal = useDisclosure()

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
            {localServerRunning ? (
              <Box mr={4} width="60%">
                <Text>The local server is running.</Text>
                {/* Actions that are only possible if repo has been cloned */}
                {localWorkingDir ? (
                  <>
                    <Button m={2} variant="primary" onClick={openVSCode}>
                      Open in VSCode <Icon ml={1} as={FiExternalLink} />
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
                  </>
                ) : (
                  ""
                )}
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
                  onClick={() => {
                    statusQuery.refetch()
                    pipelineQuery.refetch()
                  }}
                  isLoading={statusQuery.isRefetching}
                />
              </Flex>
              {statusQuery.isPending ||
              statusQuery.isRefetching ||
              pipelineQuery.isPending ||
              pipelineQuery.isRefetching ? (
                <Flex
                  justify="center"
                  align="center"
                  height="full"
                  width="full"
                >
                  <Spinner size="xl" color="ui.main" />
                </Flex>
              ) : (
                <>
                  {localWorkingDir ? (
                    <Text>
                      The repo is cloned locally in{" "}
                      <Link onClick={openFolder}>{localWorkingDir}</Link>.
                    </Text>
                  ) : (
                    <Flex alignItems="center">
                      <Text>
                        The repo has not yet been cloned to this machine.
                      </Text>
                      <Button
                        ml={1}
                        size="xs"
                        variant="primary"
                        onClick={() => cloneMutation.mutate()}
                        isLoading={cloneMutation.isPending}
                      >
                        Clone
                      </Button>
                    </Flex>
                  )}
                  {!statusQuery.isPending && !statusQuery.error ? (
                    <>
                      <Heading size="sm" mb={1} mt={4}>
                        Cloud sync
                      </Heading>
                      {commitsAhead ? (
                        <Flex alignItems="center">
                          <Text mr={1} color="yellow.500">
                            There are {commitsAhead} commits to push to Git
                            remote.
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
                          <Text mr={1} color="yellow.500">
                            There are {commitsBehind} commits to pull from Git
                            remote.
                          </Text>
                          <Button
                            variant="primary"
                            size="xs"
                            aria-label="pull"
                            onClick={() => console.log("TODO: Git pull")}
                          >
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
                      {dvcNeedsPull ? (
                        <Text color="yellow.500">
                          There are changes to pull from DVC remote.
                        </Text>
                      ) : (
                        ""
                      )}
                      {dvcNeedsPush ? (
                        <Text color="yellow.500">
                          There are changes to push to DVC remote.
                        </Text>
                      ) : (
                        ""
                      )}
                      {!dvcNeedsPull && !dvcNeedsPush ? (
                        <Text>Repo is synced with DVC remote.</Text>
                      ) : (
                        ""
                      )}
                    </>
                  ) : (
                    ""
                  )}
                  {/* Untracked files */}
                  {untrackedFiles && untrackedFiles.length > 0 ? (
                    <>
                      <Heading size="sm" mb={1} mt={4}>
                        Untracked files
                      </Heading>
                      {untrackedFiles.map((fpath: string) => (
                        <Flex key={fpath} alignItems="center" mb={1}>
                          <Text color="red.500" mr={1}>
                            {fpath}
                          </Text>
                          <AddPath path={fpath} />
                          <IgnorePath path={fpath} />
                        </Flex>
                      ))}
                    </>
                  ) : (
                    ""
                  )}
                  {/* Changed files */}
                  <Flex alignItems="center" mb={1} mt={4}>
                    <Heading size="sm">Uncommitted changes</Heading>
                    <Button size="xs" variant="primary" ml={1}>
                      Save
                    </Button>
                    <Button size="xs" variant="danger" ml={1}>
                      Discard
                    </Button>
                  </Flex>
                  {stagedFiles ? (
                    <>
                      {stagedFiles.map((fpath: string) => (
                        <Flex key={fpath} alignItems="center">
                          <Text color="green.500" mr={1}>
                            {fpath}
                          </Text>
                        </Flex>
                      ))}
                    </>
                  ) : (
                    ""
                  )}
                  {changedFiles ? (
                    <>
                      {changedFiles.map((fpath: string) => (
                        <Flex key={fpath} alignItems="center">
                          <Checkbox>
                            <Text color="red.500" mr={1}>
                              {fpath}
                            </Text>
                          </Checkbox>
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
                    {localWorkingDir && !pipelineUpToDate ? (
                      <Flex alignItems="center">
                        <Badge mr={1} color="yellow.500">
                          Out-of-date
                        </Badge>
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
                    <Button
                      ml={1}
                      variant="primary"
                      size="xs"
                      onClick={newStageModal.onOpen}
                    >
                      <Icon mr={0.5} as={FaPlus} /> New stage
                    </Button>
                    <NewStage
                      isOpen={newStageModal.isOpen}
                      onClose={newStageModal.onClose}
                    />
                  </Flex>
                  {!pipelineQuery.error && pipelineQuery.data?.data ? (
                    <>
                      <Heading size="xs">All stages</Heading>
                      <UnorderedList>
                        {Object.entries(pipelineQuery.data.data.stages).map(
                          ([k, _]) => (
                            <ListItem key={k}>
                              <Code fontSize="small">{k}</Code>
                            </ListItem>
                          ),
                        )}
                      </UnorderedList>
                    </>
                  ) : (
                    ""
                  )}
                </>
              )}
            </Box>
          </Flex>
        )}
      </Box>
    </>
  )
}
