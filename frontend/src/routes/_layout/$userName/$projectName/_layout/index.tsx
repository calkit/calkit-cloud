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
  Code,
} from "@chakra-ui/react"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { useState } from "react"
import { FaPlus, FaSync } from "react-icons/fa"
import { MdEdit } from "react-icons/md"
import { ExternalLinkIcon } from "@chakra-ui/icons"

import Markdown from "../../../../../components/Common/Markdown"
import CreateIssue from "../../../../../components/Projects/CreateIssue"
import CreateQuestion from "../../../../../components/Projects/CreateQuestion"
import NewPublication from "../../../../../components/Publications/NewPublication"
import useProject, {
  useProjectIssues,
  useProjectQuestions,
  useProjectReadme,
} from "../../../../../hooks/useProject"
import ProjectShowcase from "../../../../../components/Projects/ProjectShowcase"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/",
)({
  component: Project,
})

function ProjectView() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { userName, projectName } = Route.useParams()
  const [showClosedTodos, setShowClosedTodos] = useState(false)
  const {
    projectRequest,
    reproCheckRequest,
    putDevcontainerMutation,
    userHasWriteAccess,
  } = useProject(userName, projectName)
  const { issuesRequest, issueStateMutation } = useProjectIssues(
    userName,
    projectName,
    showClosedTodos,
  )
  const { readmeRequest } = useProjectReadme(userName, projectName)
  const { questionsRequest } = useProjectQuestions(userName, projectName)
  const reproCheck = reproCheckRequest.data
  const gitRepoUrl = projectRequest.data?.git_repo_url
  const codespacesUrl =
    String(gitRepoUrl).replace("://github.com/", "://codespaces.new/") +
    "?quickstart=1"
  const removeFirstLine = (txt: any) => {
    let lines = String(txt).split("\n")
    lines.splice(0, 1)
    return lines.join("\n")
  }
  const onClosedTodosSwitch = (e: any) => {
    setShowClosedTodos(e.target.checked)
  }
  const onTodoCheckbox = (e: any) => {
    issueStateMutation.mutate({
      issueNumber: e.target.id as number,
      state: e.target.checked ? "closed" : "open",
    })
  }
  const newIssueModal = useDisclosure()
  const newQuestionModal = useDisclosure()
  const newPubTemplateModal = useDisclosure()

  return (
    <>
      <Flex mt={1}>
        <Box width="60%" mr={8}>
          {/* Showcase */}
          <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
            <Flex alignItems="center">
              <Heading size="md">Showcase</Heading>
              {userHasWriteAccess ? (
                <>
                  <Link
                    href={`https://github.dev/${userName}/${projectName}/blob/main/calkit.yaml`}
                    isExternal
                  >
                    <IconButton
                      aria-label="Edit calkit.yaml"
                      height="25px"
                      width="28px"
                      ml={1.5}
                      icon={<MdEdit />}
                      size={"xs"}
                    />
                  </Link>
                </>
              ) : (
                ""
              )}
            </Flex>
            <ProjectShowcase ownerName={userName} projectName={projectName} />
          </Box>
          {/* README */}
          <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
            <Flex alignItems="center">
              <Heading size="md">README</Heading>
              {userHasWriteAccess ? (
                <>
                  <Link
                    href={`https://github.dev/${userName}/${projectName}/blob/main/README.md`}
                    isExternal
                  >
                    <IconButton
                      aria-label="Edit README"
                      height="25px"
                      width="28px"
                      ml={1.5}
                      icon={<MdEdit />}
                      size={"xs"}
                    />
                  </Link>
                </>
              ) : (
                ""
              )}
            </Flex>
            {readmeRequest.isPending ? (
              <Flex justify="center" align="center" height="100vh" width="full">
                <Spinner size="xl" color="ui.main" />
              </Flex>
            ) : readmeRequest.data ? (
              <Markdown>
                {removeFirstLine(atob(String(readmeRequest?.data?.content)))}
              </Markdown>
            ) : (
              ""
            )}
          </Box>
        </Box>
        <Box width={"40%"}>
          {/* Questions  */}
          <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
            <Flex>
              <Heading size="md" mb={2}>
                Questions
              </Heading>
              {userHasWriteAccess ? (
                <>
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
                </>
              ) : (
                ""
              )}
            </Flex>
            {questionsRequest.isPending ? (
              <Flex justify="center" align="center" height="100px" width="full">
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
          {/* To-dos (issues) */}
          <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
            <Flex width="full" alignItems="center" mb={2}>
              <Box>
                <Flex>
                  <Heading size="md">To-do</Heading>
                  {userHasWriteAccess ? (
                    <>
                      <IconButton
                        aria-label="Add to-do"
                        height="25px"
                        width="28px"
                        ml={1.5}
                        icon={<FaPlus />}
                        size={"xs"}
                        onClick={newIssueModal.onOpen}
                      />
                      <CreateIssue
                        isOpen={newIssueModal.isOpen}
                        onClose={newIssueModal.onClose}
                      />
                    </>
                  ) : (
                    ""
                  )}
                </Flex>
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
              <Flex justify="center" align="center" height="100%" width="100%">
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
                      isDisabled={!userHasWriteAccess}
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
          {/* Reproducibility check */}
          <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
            <Flex>
              <Heading size="md" mb={2}>
                Reproducibility check
              </Heading>
              <IconButton
                aria-label="Refresh repro check"
                height="25px"
                width="28px"
                ml={1.5}
                icon={<FaSync />}
                size={"xs"}
                onClick={() => reproCheckRequest.refetch()}
              />
            </Flex>
            {reproCheckRequest.isPending ||
            reproCheckRequest.isRefetching ||
            putDevcontainerMutation.isPending ? (
              <Flex justify="center" align="center" height="100px" width="full">
                <Spinner size="xl" color="ui.main" />
              </Flex>
            ) : (
              <>
                <Text>
                  Has README.md: {reproCheck?.has_readme ? "✅" : "❌"}
                </Text>
                <Text>
                  README.md has instructions:{" "}
                  {reproCheck?.instructions_in_readme ? "✅" : "❌"}
                </Text>
                <Text>
                  DVC initialized: {reproCheck?.is_dvc_repo ? "✅" : "❌"}
                </Text>
                <Text>
                  DVC remote defined: {reproCheck?.n_dvc_remotes ? "✅" : "❌"}
                </Text>
                <Text>
                  Has pipeline (<Code>dvc.yaml</Code>):{" "}
                  {reproCheck?.has_pipeline ? "✅" : "❌"}
                </Text>
                <Text>
                  Has Calkit metadata (<Code>calkit.yaml</Code>):{" "}
                  {reproCheck?.has_calkit_info ? "✅" : "❌"}
                </Text>
                <Text>
                  Has dev container spec:{" "}
                  {reproCheck?.has_dev_container ? (
                    "✅"
                  ) : (
                    <>
                      {"❌ "}
                      {userHasWriteAccess ? (
                        <Link onClick={() => putDevcontainerMutation.mutate()}>
                          🔧
                        </Link>
                      ) : (
                        ""
                      )}
                    </>
                  )}
                </Text>
                <Text>
                  Environments defined:{" "}
                  {reproCheck ? (
                    <>
                      {reproCheck.n_environments}{" "}
                      {reproCheck.n_environments ? "✅" : "❌"}
                    </>
                  ) : (
                    ""
                  )}
                </Text>
                <Text>
                  Pipeline stages run in an environment:{" "}
                  {reproCheck ? (
                    <>
                      {reproCheck.n_stages_with_env}/{reproCheck.n_stages}{" "}
                      {reproCheck.n_stages_without_env ? "❌" : "✅"}
                    </>
                  ) : (
                    ""
                  )}
                </Text>
                <Text>
                  Datasets imported or created by pipeline:{" "}
                  {reproCheck ? (
                    <>
                      {reproCheck.n_datasets_with_import_or_stage}/
                      {reproCheck.n_datasets}{" "}
                      {reproCheck.n_datasets_no_import_or_stage ? "❌" : "✅"}
                    </>
                  ) : (
                    ""
                  )}
                </Text>
                <Text>
                  Figures imported or created by pipeline:{" "}
                  {reproCheck ? (
                    <>
                      {reproCheck.n_figures_with_import_or_stage}/
                      {reproCheck.n_figures}{" "}
                      {reproCheck.n_figures_no_import_or_stage ? "❌" : "✅"}
                    </>
                  ) : (
                    ""
                  )}
                </Text>
                <Text>
                  Publications imported or created by pipeline:{" "}
                  {reproCheck ? (
                    <>
                      {reproCheck.n_publications_with_import_or_stage}/
                      {reproCheck.n_publications}{" "}
                      {reproCheck.n_publications_no_import_or_stage
                        ? "❌"
                        : "✅"}
                    </>
                  ) : (
                    ""
                  )}
                </Text>
                {userHasWriteAccess ? (
                  <>
                    <Heading
                      size="sm"
                      mt={4}
                      mb={-2}
                      color={
                        reproCheck?.recommendation ? "yellow.500" : "green.500"
                      }
                    >
                      Recommendation
                    </Heading>
                    {reproCheck?.recommendation ? (
                      <>
                        <Markdown>{reproCheck.recommendation}</Markdown>
                      </>
                    ) : (
                      <Markdown>
                        This project looks good from here! Check in depth
                        locally with `calkit status` and `calkit run`.
                      </Markdown>
                    )}
                  </>
                ) : (
                  ""
                )}
              </>
            )}
          </Box>
          {/* Quick actions */}
          {userHasWriteAccess ? (
            <>
              <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
                <Heading size="md" mb={2}>
                  Quick actions
                </Heading>
                <Text>
                  📜{" "}
                  <Link onClick={newPubTemplateModal.onOpen}>
                    Create a new publication from a template
                  </Link>
                </Text>
                <Text>
                  🔒{" "}
                  <Link
                    as={RouterLink}
                    to={"/settings"}
                    search={{ tab: "tokens" } as any}
                  >
                    Manage user tokens
                  </Link>
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
              <NewPublication
                isOpen={newPubTemplateModal.isOpen}
                onClose={newPubTemplateModal.onClose}
                variant="template"
              />
            </>
          ) : (
            ""
          )}
        </Box>
      </Flex>
    </>
  )
}

function Project() {
  return <ProjectView />
}
