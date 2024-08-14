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

const itemsSearchSchema = z.object({
  page: z.number().catch(1),
})

export const Route = createFileRoute("/_layout/")({
  component: Projects,
})

const PER_PAGE = 5

function getItemsQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      ProjectsService.getOwnedProjects({
        offset: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
      }),
    queryKey: ["items", { page }],
  }
}

function ProjectsTable() {
  const queryClient = useQueryClient()
  const { page } = itemsSearchSchema.parse(Route.useSearch())
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, page }) })

  const {
    data: items,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...getItemsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

  const hasNextPage = !isPlaceholderData && items?.data.length === PER_PAGE
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getItemsQueryOptions({ page: page + 1 }))
    }
  }, [page, queryClient, hasNextPage])

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Name</Th>
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
              {items?.data.map((item) => (
                <Tr key={item.id} opacity={isPlaceholderData ? 0.5 : 1}>
                  <Td isTruncated maxWidth="60px">
                    {item.id}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    {/* TODO: Project paths should be forced to match GitHub URL? */}
                    <Link
                      as={RouterLink}
                      to={item.owner_github_username + "/" + item.name_slug}
                    >
                      {item.name}
                    </Link>
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Link href={item.git_repo_url} isExternal>
                      <ExternalLinkIcon mx="2px" /> {item.git_repo_url}
                    </Link>
                  </Td>
                  <Td
                    color={!item.description ? "ui.dim" : "inherit"}
                    isTruncated
                    maxWidth="150px"
                  >
                    {item.description || "N/A"}
                  </Td>
                  <Td>
                    <ActionsMenu type={"Project"} value={item} />
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

  // TODO: Get public projects from API

  const {
    data: items,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...getItemsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

  const hasNextPage = !isPlaceholderData && items?.data.length === PER_PAGE

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getItemsQueryOptions({ page }))
    }
  }, [page, queryClient, hasNextPage])

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Name</Th>
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
              {items?.data.map((item) => (
                <Tr key={item.id} opacity={isPlaceholderData ? 0.5 : 1}>
                  <Td isTruncated maxWidth="60px">
                    {item.id}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    {item.name}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Link href={item.git_repo_url} isExternal>
                      <ExternalLinkIcon mx="2px" /> {item.git_repo_url}
                    </Link>
                  </Td>
                  <Td
                    color={!item.description ? "ui.dim" : "inherit"}
                    isTruncated
                    maxWidth="150px"
                  >
                    {item.description || "N/A"}
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
          <Navbar type={"project"} addModalAs={CreateProject} />
        </Box>
        <Box mr={4}>
          <Navbar type={"from GitHub"} addModalAs={CreateProjectFromGitHub} />
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
        Other public projects
      </Heading>
      <PublicProjectsTable />
    </Container>
  )
}
