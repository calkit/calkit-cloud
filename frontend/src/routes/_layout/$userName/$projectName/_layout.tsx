import {
  Container,
  Flex,
  Spinner,
  Heading,
  Link,
  Icon,
  Drawer,
  IconButton,
  useDisclosure,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  Text,
  Code,
} from "@chakra-ui/react"
import {
  createFileRoute,
  Outlet,
  Link as RouterLink,
} from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { FaGithub, FaQuestion } from "react-icons/fa"

import Sidebar from "../../../../components/Common/Sidebar"
import NotFound from "../../../../components/Common/NotFound"
import { ProjectsService } from "../../../../client"

export const Route = createFileRoute("/_layout/$userName/$projectName/_layout")(
  {
    component: ProjectLayout,
  },
)

function HelpContent() {
  const { userName, projectName } = Route.useParams()
  const page = location.pathname.split("/").at(-1)
  const mb = 4
  if (page === "files") {
    return (
      <>
        <Text mb={mb}>
          This view shows the full project working directory, including files
          tracked by Git (typically text files like code and Markdown documents)
          and files tracked by DVC, e.g., datasets, figure PDFs or PNGs, etc.
          Note that files tracked with DVC are typically larger, and are not
          populated on your local machine when cloning the project repo. These
          can be fetched with <Code>dvc pull</Code>.
        </Text>
        <Text>
          Artifacts labeled with Calkit are highlighted with a green icon.
          Labeling artifacts is a way to clarify "special" files or folders that
          have a specific meaning to the project. For example, a certain folder
          may contain an important dataset used in the workflow to produce a
          certain figure, which is also labeled as a <Code>figure</Code>{" "}
          artifact.
        </Text>
      </>
    )
  }
  if (page === "publications") {
    return (
      <>
        <Text mb={mb}>
          Publications are artifacts created as part of project such as journal
          articles, presentations or slide decks, technical reports, etc.
          Ideally these should be produced as part of the workflow, but for
          users of non-text-based tools like Microsoft Office and Google
          Workspace these can be uploaded and updated manually. However, it is
          recommended to export them to PDF. The source files, e.g., a{" "}
          <Code>*.docx</Code> file, can be added as a dependency, but should
          most likely not be the artifact itself.
        </Text>
      </>
    )
  }
  if (page === "figures") {
    return (
      <>
        <Text mb={mb}>
          Figures are visualizations of data or results. These will typically be
          produced in workflow stages with datasets and code as their
          dependencies so they can be easily reproduced or updated if their
          dependencies change. They will also typically be inserted into
          publications.
        </Text>
        <Text mb={mb}>
          To create a new figure, either upload a new file or label an existing
          file by clicking the <Code>+</Code> button to the left. Alternatively,
          it is possible to add a figure by editing the project's{" "}
          <Code>calkit.yaml</Code> file.
        </Text>
      </>
    )
  }
  if (page === "data" || page === "datasets") {
    return (
      <>
        <Text mb={mb}>
          Datasets can be produced as part of a project or imported from a
          different project for further synthesis and analysis. They are
          typically dependencies and/or outputs in the workflow. An output
          dataset might be produced as part of a workflow stage that reduced
          some raw data. A dataset that is merely a dependency could be produced
          as part of an experiment's data collection process.
        </Text>
        <Text mb={mb}>
          Labeling a file or folder as a dataset helps clarify its purpose, and
          if the project is open to the public, helps facilitate its reuse in
          further studies.
        </Text>
        <Text mb={mb}>
          To create a new dataset, either upload a new file or label an existing
          file or folder by clicking the <Code>+</Code> button to the left.
          Alternatively, it is possible to label a dataset by editing the
          project's <Code>calkit.yaml</Code> file.
        </Text>
      </>
    )
  }
  if (page === "workflow") {
    return (
      <>
        <Text mb={mb}>
          The project workflow (or "pipeline" in DVC terminology) describes the
          steps (or "stages") taken to produce all of the desired outputs. For
          example, one stage could involve processing the raw data. Another
          could create a figure from these. Another could produce a publication.
          The workflow can be run locally by executing <Code>dvc repro</Code> in
          the project working directory.
        </Text>
        <Text mb={mb}>
          For instructions on how to create your workflow, see the{" "}
          <Link
            isExternal
            href="https://dvc.org/doc/start/data-pipelines/data-pipelines"
          >
            DVC documentation
          </Link>
          .
        </Text>
      </>
    )
  }
  if (page === "collaborators") {
    return (
      <>
        <Text mb={mb}>
          Collaborators are other users who can edit your project. This means
          the are able to clone the Git repo, push changes to GitHub, etc.
        </Text>
      </>
    )
  }
  if (page === "local") {
    return (
      <>
        <Text mb={mb}>
          This page provides an interface for interacting with the project
          working directory on your local machine. For this to work, the local
          Calkit server must be running. To start one up, navigate into the
          project folder and run <Code>calkit server</Code> in a terminal.
        </Text>
      </>
    )
  }
  return (
    <>
      <Text mb={mb}>
        Welcome to your Calkit project! To get started, try adding some{" "}
        questions you'd like to answer, or start defining the{" "}
        <Link as={RouterLink} to={`/${userName}/${projectName}/workflow`}>
          workflow
        </Link>{" "}
        for how you'd like your outputs or artifacts to be created.
      </Text>
    </>
  )
}

function ProjectLayout() {
  const { userName, projectName } = Route.useParams()
  const {
    isPending,
    error,
    data: project,
  } = useQuery({
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
  if (error?.message === "Not Found") {
    return <NotFound />
  }
  const helpDrawer = useDisclosure()

  return (
    <>
      {isPending ? (
        <Flex justify="center" align="center" height="90%" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          <Sidebar basePath={`/${userName}/${projectName}`} />
          <Container maxW="full" mx={6}>
            <Flex width={"full"}>
              <Heading
                size="lg"
                textAlign={{ base: "center", md: "left" }}
                alignContent={"center"}
                mt={6}
                mb={3}
              >
                {project?.name}
                {project?.git_repo_url ? (
                  <Link href={project?.git_repo_url} isExternal>
                    <Icon height="45%" as={FaGithub} pl={3} pr={0} mr={0} />
                    <Icon height={"50%"} as={ExternalLinkIcon} pl={0} ml={0} />
                  </Link>
                ) : (
                  ""
                )}
                <IconButton
                  isRound
                  aria-label="Open help"
                  size={"xs"}
                  onClick={helpDrawer.onOpen}
                  icon={<FaQuestion />}
                />
              </Heading>
            </Flex>
            <Outlet />
          </Container>
          <Drawer
            isOpen={helpDrawer.isOpen}
            onClose={helpDrawer.onClose}
            placement="right"
            size="sm"
          >
            <DrawerOverlay />
            <DrawerContent>
              <DrawerCloseButton />
              <DrawerHeader>Help</DrawerHeader>
              <DrawerBody>
                <HelpContent />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </Flex>
      )}
    </>
  )
}
