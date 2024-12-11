import {
  Box,
  Spinner,
  Flex,
  Heading,
  Text,
  OrderedList,
  ListItem,
  useColorModeValue,
  Checkbox,
  FormControl,
  FormLabel,
  Switch,
  Spacer,
  useDisclosure,
  IconButton,
  Link,
  Icon,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { FaPlus } from "react-icons/fa"
import { ExternalLinkIcon } from "@chakra-ui/icons"

import { ProjectsService } from "../../../../../client"
import Markdown from "../../../../../components/Common/Markdown"
import CreateIssue from "../../../../../components/Projects/CreateIssue"
import CreateQuestion from "../../../../../components/Projects/CreateQuestion"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/",
)({
  component: Project,
})

function ProjectView() {
  const queryClient = useQueryClient()
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { userName, projectName } = Route.useParams()
  const projectRequest = useQuery({
    queryKey: ["projects", userName, projectName],
    queryFn: () =>
      ProjectsService.getProjectByName({
        ownerName: userName,
        projectName: projectName,
      }),
    retry: (failureCount, error) => {
      if (error.message === "Not Found") {
        return false
      }
      return failureCount < 3
    },
  })
  const gitRepoUrl = projectRequest.data?.git_repo_url
  const codespacesUrl =
    String(gitRepoUrl).replace("://github.com/", "://codespaces.new/") +
    "?quickstart=1"
  const [showClosedTodos, setShowClosedTodos] = useState(false)
  const readmeRequest = useQuery({
    queryKey: ["projects", userName, projectName, "readme"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: "README.md",
      }),
  })
  const issuesRequest = useQuery({
    queryKey: ["projects", userName, projectName, "issues", showClosedTodos],
    queryFn: () =>
      ProjectsService.getProjectIssues({
        ownerName: userName,
        projectName: projectName,
        state: showClosedTodos ? "all" : "open",
      }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
  const removeFirstLine = (txt: any) => {
    let lines = String(txt).split("\n")
    lines.splice(0, 1)
    return lines.join("\n")
  }
  const questionsRequest = useQuery({
    queryKey: ["projects", userName, projectName, "questions"],
    queryFn: () =>
      ProjectsService.getProjectQuestions({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const onClosedTodosSwitch = (e: any) => {
    setShowClosedTodos(e.target.checked)
  }
  interface IssueStateChange {
    state: "open" | "closed"
    issueNumber: number
  }
  const issueStateMutation = useMutation({
    mutationFn: (data: IssueStateChange) =>
      ProjectsService.patchProjectIssue({
        ownerName: userName,
        projectName: projectName,
        issueNumber: data.issueNumber,
        requestBody: { state: data.state },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["projects", userName, projectName, "issues"],
      }),
  })
  const onTodoCheckbox = (e: any) => {
    issueStateMutation.mutate({
      issueNumber: e.target.id as number,
      state: e.target.checked ? "closed" : "open",
    })
  }
  const newIssueModal = useDisclosure()
  const newQuestionModal = useDisclosure()

  return (
    <>
      {readmeRequest.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex mt={1}>
          <Box width="60%" mr={8}>
            <Box
              py={4}
              px={6}
              mb={4}
              borderRadius="lg"
              bg={secBgColor}
              maxH={"60vh"}
              overflow="auto"
            >
              <Heading size="md">About</Heading>
              {readmeRequest.data ? (
                <Markdown>
                  {removeFirstLine(atob(String(readmeRequest?.data?.content)))}
                </Markdown>
              ) : (
                ""
              )}
            </Box>
            {/* To-dos (issues) */}
            <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
              <Flex width="full" alignItems="center" mb={2}>
                <Box>
                  <Flex>
                    <Heading size="md">To-do</Heading>
                    <IconButton
                      aria-label="Add to-do"
                      height="25px"
                      width="28px"
                      ml={1.5}
                      icon={<FaPlus />}
                      size={"xs"}
                      onClick={newIssueModal.onOpen}
                    />
                  </Flex>
                  <CreateIssue
                    isOpen={newIssueModal.isOpen}
                    onClose={newIssueModal.onClose}
                  />
                </Box>
                <Spacer />
                <Box>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="show-closed" mb="0">
                      Show closed
                    </FormLabel>
                    <Switch
                      id="show-closed"
                      isChecked={showClosedTodos}
                      onChange={onClosedTodosSwitch}
                    />
                  </FormControl>
                </Box>
              </Flex>
              {issuesRequest.isPending ||
              issuesRequest.isRefetching ||
              issueStateMutation.isPending ? (
                <Flex
                  justify="center"
                  align="center"
                  height="100%"
                  width="100%"
                >
                  <Spinner size="xl" color="ui.main" />
                </Flex>
              ) : (
                <>
                  {issuesRequest?.data?.map((issue) => (
                    <Flex
                      key={issue.number}
                      alignItems={"center"}
                      alignContent={"center"}
                    >
                      <Checkbox
                        isChecked={issue.state === "closed"}
                        onChange={onTodoCheckbox}
                        id={String(issue.number)}
                      />
                      <Text ml={2}>
                        {" "}
                        {issue.title} (
                        <Link isExternal href={issue.url}>
                          #{issue.number}
                        </Link>
                        )
                      </Text>
                    </Flex>
                  ))}
                </>
              )}
            </Box>
          </Box>
          <Box width={"40%"}>
            <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
              <Flex>
                <Heading size="md" mb={2}>
                  Questions
                </Heading>
                <IconButton
                  aria-label="Add question"
                  height="25px"
                  width="28px"
                  ml={1.5}
                  icon={<FaPlus />}
                  size={"xs"}
                  onClick={newQuestionModal.onOpen}
                />
                <CreateQuestion
                  isOpen={newQuestionModal.isOpen}
                  onClose={newQuestionModal.onClose}
                />
              </Flex>
              {questionsRequest.isPending ? (
                <Flex
                  justify="center"
                  align="center"
                  height="100px"
                  width="full"
                >
                  <Spinner size="xl" color="ui.main" />
                </Flex>
              ) : (
                <OrderedList>
                  {questionsRequest.data?.map((question) => (
                    <ListItem key={question.question}>
                      {question.question}
                    </ListItem>
                  ))}
                </OrderedList>
              )}
            </Box>
            <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
              <Heading size="md" mb={2}>
                Quick actions
              </Heading>
              <Text>
                📜 <Link>Create a new publication</Link>
              </Text>
              <Text>
                🚀{" "}
                <Link isExternal href={codespacesUrl}>
                  Open in GitHub Codespaces{" "}
                  <Icon height={"40%"} as={ExternalLinkIcon} pb={0.5} />
                </Link>
              </Text>
              <Text>
                🔑{" "}
                <Link
                  isExternal
                  href={`${gitRepoUrl}/settings/secrets/codespaces`}
                >
                  Configure GitHub Codespaces secrets{" "}
                  <Icon height={"40%"} as={ExternalLinkIcon} pb={0.5} />
                </Link>
              </Text>
            </Box>
          </Box>
        </Flex>
      )}
    </>
  )
}

function Project() {
  return <ProjectView />
}
