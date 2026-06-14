import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import {
  Box,
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@chakra-ui/react"
import {
  createFileRoute,
  Link as RouterLink,
  useSearch,
} from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { FaPlus } from "react-icons/fa"
import { MdEdit } from "react-icons/md"
import { ExternalLinkIcon } from "@chakra-ui/icons"

import Markdown from "../../../../../components/Common/Markdown"
import { ReleasesService, type ReleaseListItem } from "../../../../../client"
import { decodeBase64Utf8 } from "../../../../../lib/strings"
import { releaseExternalLink } from "../../../../../lib/releases"
import CreateIssue from "../../../../../components/Projects/CreateIssue"
import CreateQuestion from "../../../../../components/Projects/CreateQuestion"
import NewPublication from "../../../../../components/Publications/NewPublication"
import NewRelease from "../../../../../components/Releases/NewRelease"
import ReleaseDetailsModal from "../../../../../components/Releases/ReleaseDetailsModal"
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
  const layoutSearch = useSearch({
    from: "/_layout/$accountName/$projectName/_layout" as any,
    strict: false,
  }) as any
  const ref: string | undefined = layoutSearch?.ref
  const [showClosedTodos, setShowClosedTodos] = useState(false)
  const { projectRequest, userHasWriteAccess } = useProject(
    accountName,
    projectName,
    ref,
  )
  const { issuesRequest, issueStateMutation, registerCreatedIssue } =
    useProjectIssues(accountName, projectName)
  const visibleIssues = issuesRequest.data?.filter(
    (issue) => showClosedTodos || issue.state === "open",
  )
  const { readmeRequest } = useProjectReadme(accountName, projectName, ref)
  const { questionsRequest } = useProjectQuestions(
    accountName,
    projectName,
    ref,
  )
  // Shares its cache with the History page's Releases tab (same query key), so
  // creating a release refreshes both.
  const releasesRequest = useQuery({
    queryKey: ["projects", accountName, projectName, "releases", undefined],
    queryFn: () =>
      ReleasesService.getProjectReleases({
        ownerName: accountName,
        projectName,
      }),
  })
  // Release opened in the details modal (null = closed).
  const [detailRelease, setDetailRelease] = useState<ReleaseListItem | null>(
    null,
  )
  // Newest first (ISO dates sort lexically); show only the latest few on the
  // home page and link to the full list on the History page.
  const HOME_RELEASES_LIMIT = 5
  const sortedReleases = [...(releasesRequest.data ?? [])].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  )
  const topReleases = sortedReleases.slice(0, HOME_RELEASES_LIMIT)
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
      // e.target.id is the DOM id string; coerce it to a number so it
      // matches issue.number when updating the cache.
      issueNumber: Number(e.target.id),
      state: e.target.checked ? "closed" : "open",
    })
  }
  const newIssueModal = useDisclosure()
  const newQuestionModal = useDisclosure()
  const newReleaseModal = useDisclosure()
  const newPubTemplateModal = useDisclosure()
  const overleafImportModal = useDisclosure()

  return (
    <>
      <Flex mt={1}>
        <Box width="65%" mr={8}>
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
              gitRef={ref}
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
              <LoadingSpinner height="100vh" />
            ) : readmeRequest.data ? (
              <Markdown>
                {removeFirstLine(
                  decodeBase64Utf8(String(readmeRequest?.data?.content)),
                )}
              </Markdown>
            ) : (
              ""
            )}
          </Box>
        </Box>
        <Box width={"35%"}>
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
              <LoadingSpinner height="100px" />
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
                        onCreated={registerCreatedIssue}
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
            {issuesRequest.isPending ? (
              <LoadingSpinner />
            ) : (
              <>
                {visibleIssues?.map((issue) => {
                  const routeMap: Record<string, string> = {
                    figure: "figures",
                    publication: "publications",
                    notebook: "notebooks",
                    file: "files",
                  }
                  const artifactRoute = issue.artifact_type
                    ? routeMap[issue.artifact_type] ?? "files"
                    : null
                  const artifactHref =
                    artifactRoute && issue.artifact_path
                      ? `/${accountName}/${projectName}/${artifactRoute}?path=${encodeURIComponent(issue.artifact_path)}`
                      : null
                  return (
                    <Flex key={issue.number} alignItems={"flex-start"}>
                      <Checkbox
                        isChecked={issue.state === "closed"}
                        onChange={onTodoCheckbox}
                        id={String(issue.number)}
                        isDisabled={!userHasWriteAccess}
                        mt={1}
                      />
                      <Text ml={2}>
                        {" "}
                        {artifactHref ? (
                          <Link as={RouterLink} to={artifactHref as any}>
                            {issue.title}
                          </Link>
                        ) : (
                          issue.title
                        )}{" "}
                        (
                        <Link isExternal href={issue.url}>
                          #{issue.number}
                        </Link>
                        )
                      </Text>
                    </Flex>
                  )
                })}
              </>
            )}
          </Box>
          {/* Releases */}
          <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
            <Flex>
              <Heading size="md" mb={2}>
                <Link
                  as={RouterLink}
                  to={`/${accountName}/${projectName}/history`}
                  search={{ tab: "releases" } as any}
                >
                  Releases
                </Link>
              </Heading>
              {userHasWriteAccess ? (
                <>
                  <IconButton
                    aria-label="Add release"
                    height="25px"
                    width="28px"
                    ml={1.5}
                    icon={<FaPlus />}
                    size={"xs"}
                    onClick={newReleaseModal.onOpen}
                  />
                  <NewRelease
                    isOpen={newReleaseModal.isOpen}
                    onClose={newReleaseModal.onClose}
                    ownerName={accountName}
                    projectName={projectName}
                    kind="project"
                  />
                </>
              ) : (
                ""
              )}
            </Flex>
            {releasesRequest.isPending ? (
              <LoadingSpinner height="100px" />
            ) : topReleases.length > 0 ? (
              <>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th px={2}>Name</Th>
                      <Th px={2}>Path</Th>
                      <Th px={2}>Date</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {topReleases.map((release) => {
                      const link = releaseExternalLink(release)
                      const pathLabel =
                        release.path && release.path !== "."
                          ? release.path
                          : "Project"
                      return (
                        <Tr key={`${release.source}-${release.name}`}>
                          <Td px={2}>
                            <Link onClick={() => setDetailRelease(release)}>
                              {release.name}
                            </Link>
                            {link && (
                              <Link
                                href={link.href}
                                isExternal
                                ml={1}
                                aria-label={`Open ${link.label}`}
                              >
                                <Icon as={ExternalLinkIcon} />
                              </Link>
                            )}
                          </Td>
                          <Td px={2} fontSize="sm" color="gray.500">
                            {pathLabel}
                          </Td>
                          <Td px={2} fontSize="sm" color="gray.500">
                            {release.date ?? "—"}
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
                {sortedReleases.length > topReleases.length ? (
                  <Link
                    as={RouterLink}
                    to={`/${accountName}/${projectName}/history`}
                    search={{ tab: "releases" } as any}
                    fontSize="sm"
                  >
                    View all {sortedReleases.length} releases →
                  </Link>
                ) : (
                  ""
                )}
              </>
            ) : (
              <Text fontSize="sm" color="gray.500">
                No releases yet.
              </Text>
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
      <ReleaseDetailsModal
        isOpen={!!detailRelease}
        onClose={() => setDetailRelease(null)}
        release={detailRelease}
      />
    </>
  )
}

function Project() {
  return <ProjectView />
}
