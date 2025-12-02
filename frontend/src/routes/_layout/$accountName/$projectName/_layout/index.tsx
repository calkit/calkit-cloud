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
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { useState } from "react"
import { FaPlus } from "react-icons/fa"
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
import ImportOverleaf from "../../../../../components/Publications/ImportOverleaf"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/",
)({
  component: Project,
})

function ProjectView() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { accountName, projectName } = Route.useParams()
  const [showClosedTodos, setShowClosedTodos] = useState(false)
  const { projectRequest, userHasWriteAccess } = useProject(
    accountName,
    projectName,
  )
  const { issuesRequest, issueStateMutation } = useProjectIssues(
    accountName,
    projectName,
    showClosedTodos,
  )
  const { readmeRequest } = useProjectReadme(accountName, projectName)
  const { questionsRequest } = useProjectQuestions(accountName, projectName)
  const gitRepoUrl = projectRequest.data?.git_repo_url
  const codespacesUrl =
    String(gitRepoUrl).replace("://github.com/", "://codespaces.new/") +
    "?quickstart=1"
  const githubDevUrl = String(gitRepoUrl).replace(
    "://github.com/",
    "://github.dev/",
  )
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
  const overleafImportModal = useDisclosure()

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
                    href={`https://github.dev/${accountName}/${projectName}/blob/main/calkit.yaml`}
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
            <ProjectShowcase
              ownerName={accountName}
              projectName={projectName}
            />
          </Box>
          {/* README */}
          <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
            <Flex alignItems="center">
              <Heading size="md">README</Heading>
              {userHasWriteAccess ? (
                <>
                  <Link
                    href={`https://github.dev/${accountName}/${projectName}/blob/main/README.md`}
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
                  🍃{" "}
                  <Link onClick={overleafImportModal.onOpen}>
                    Import/link a publication from Overleaf
                  </Link>
                </Text>
                <Text>
                  🚀{" "}
                  <Link isExternal href={codespacesUrl}>
                    Open in GitHub Codespace (edit and run){" "}
                    <Icon height={"40%"} as={ExternalLinkIcon} pb={0.5} />
                  </Link>
                </Text>
                <Text>
                  ✏️{" "}
                  <Link isExternal href={githubDevUrl}>
                    Open in GitHub.dev (edit only){" "}
                    <Icon height={"40%"} as={ExternalLinkIcon} pb={0.5} />
                  </Link>
                </Text>
                <Text>
                  🔒{" "}
                  <Link
                    as={RouterLink}
                    to={"/settings"}
                    search={{ tab: "tokens" } as any}
                  >
                    Manage Calkit personal access tokens
                  </Link>
                </Text>
              </Box>
              <NewPublication
                isOpen={newPubTemplateModal.isOpen}
                onClose={newPubTemplateModal.onClose}
                variant="template"
              />
              <ImportOverleaf
                isOpen={overleafImportModal.isOpen}
                onClose={overleafImportModal.onClose}
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
