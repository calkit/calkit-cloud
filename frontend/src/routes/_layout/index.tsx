import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link,
  SkeletonText,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { ArrowForwardIcon, ExternalLinkIcon } from "@chakra-ui/icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  useNavigate,
  Link as RouterLink,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"

import { ProjectsService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"
import CreateProject from "../../components/Projects/CreateProject"
import CreateProjectFromGitHub from "../../components/Projects/CreateProjectFromGitHub"
import { pageWidthNoSidebar } from "../../utils"

const projectsSearchSchema = z.object({
  page: z.number().catch(1),
})

export const Route = createFileRoute("/_layout/")({
  component: Projects,
})

const PER_PAGE = 5

function getOwnedProjectsQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      ProjectsService.getOwnedProjects({
        offset: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
      }),
    queryKey: ["projects", { page }],
  }
}

function getAllProjectsQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      ProjectsService.getProjects({
        offset: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
      }),
    queryKey: ["projects-all", { page }],
  }
}

function ProjectsTable() {
  const queryClient = useQueryClient()
  const { page } = projectsSearchSchema.parse(Route.useSearch())
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, page }) })

  const {
    data: projects,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...getOwnedProjectsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

  const hasNextPage = !isPlaceholderData && projects?.data.length === PER_PAGE
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(
        getOwnedProjectsQueryOptions({ page: page + 1 }),
      )
    }
  }, [page, queryClient, hasNextPage])

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>GitHub URL</Th>
              <Th>Description</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          {isPending ? (
            <Tbody>
              <Tr>
                {new Array(4).fill(null).map((_, index) => (
                  <Td key={index}>
                    <SkeletonText noOfLines={1} paddingBlock="16px" />
                  </Td>
                ))}
              </Tr>
            </Tbody>
          ) : (
            <Tbody>
              {projects?.data.map((project) => (
                <Tr key={project.id} opacity={isPlaceholderData ? 0.5 : 1}>
                  <Td isTruncated maxWidth="150px">
                    <Link
                      as={RouterLink}
                      to={`${project.owner_account_name}/${project.name}`}
                    >
                      {project.title}
                    </Link>
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Link href={project.git_repo_url} isExternal>
                      <ExternalLinkIcon mx="2px" /> {project.git_repo_url}
                    </Link>
                  </Td>
                  <Td
                    color={!project.description ? "ui.dim" : "inherit"}
                    isTruncated
                    maxWidth="150px"
                  >
                    {project.description || "N/A"}
                  </Td>
                  <Td>
                    <ActionsMenu type={"Project"} value={project} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          )}
        </Table>
      </TableContainer>
      <Flex
        gap={4}
        alignItems="center"
        mt={4}
        direction="row"
        justifyContent="flex-end"
      >
        <Button onClick={() => setPage(page - 1)} isDisabled={!hasPreviousPage}>
          Previous
        </Button>
        <span>Page {page}</span>
        <Button isDisabled={!hasNextPage} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </Flex>
    </>
  )
}

function PublicProjectsTable() {
  const queryClient = useQueryClient()
  const page = 1

  const {
    data: projects,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...getAllProjectsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

  const hasNextPage = !isPlaceholderData && projects?.data.length === PER_PAGE

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getAllProjectsQueryOptions({ page }))
    }
  }, [page, queryClient, hasNextPage])

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>Owner</Th>
              <Th>Title</Th>
              <Th>GitHub URL</Th>
              <Th>Description</Th>
            </Tr>
          </Thead>
          {isPending ? (
            <Tbody>
              <Tr>
                {new Array(4).fill(null).map((_, index) => (
                  <Td key={index}>
                    <SkeletonText noOfLines={1} paddingBlock="16px" />
                  </Td>
                ))}
              </Tr>
            </Tbody>
          ) : (
            <Tbody>
              {projects?.data.map((project) => (
                <Tr key={project.id} opacity={isPlaceholderData ? 0.5 : 1}>
                  <Td isTruncated maxWidth="80px">
                    {project.owner_account_name}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Link
                      as={RouterLink}
                      to={`${project.owner_account_name}/${project.name}`}
                    >
                      {project.title}
                    </Link>
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Link href={project.git_repo_url} isExternal>
                      <ExternalLinkIcon mx="2px" /> {project.git_repo_url}
                    </Link>
                  </Td>
                  <Td
                    color={!project.description ? "ui.dim" : "inherit"}
                    isTruncated
                    maxWidth="150px"
                  >
                    {project.description || "N/A"}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          )}
        </Table>
      </TableContainer>
      <Flex
        gap={4}
        alignItems="center"
        mt={4}
        direction="row"
        justifyContent="flex-end"
      >
        <Link as={RouterLink} to="/browse">
          <Button rightIcon={<ArrowForwardIcon />}>Browse more</Button>
        </Link>
      </Flex>
    </>
  )
}

function Projects() {
  return (
    <Container maxW={pageWidthNoSidebar}>
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Your projects
      </Heading>
      <Flex>
        <Box mr={4}>
          <Navbar verb={"Create"} type={"project"} addModalAs={CreateProject} />
        </Box>
        <Box mr={4}>
          <Navbar
            verb={"Import"}
            type={"from GitHub"}
            addModalAs={CreateProjectFromGitHub}
          />
        </Box>
      </Flex>
      <ProjectsTable />
      {/* TODO: This should be public projects */}
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={10}
        pb={5}
      >
        All projects
      </Heading>
      <PublicProjectsTable />
    </Container>
  )
}
