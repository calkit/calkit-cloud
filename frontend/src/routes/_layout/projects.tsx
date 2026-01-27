import {
  Button,
  Container,
  Flex,
  Heading,
  Input,
  Link,
  SkeletonText,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/chakra"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  useNavigate,
  Link as RouterLink,
} from "@tanstack/react-router"
import { z } from "zod"
import { useEffect, useState } from "react"
import { useDebounce } from "use-debounce"

import { pageWidthNoSidebar } from "../../lib/layout"
import { ProjectsService } from "../../client"

const projectsSearchSchema = z.object({
  page: z.number().catch(1),
})

const PER_PAGE = 10

function getAllProjectsQueryOptions({
  page,
  searchFor,
}: { page: number; searchFor?: string }) {
  return {
    queryFn: () =>
      ProjectsService.getProjects({
        offset: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        searchFor: searchFor,
      }),
    queryKey: ["projects-all", { page, searchFor }],
  }
}

export const Route = createFileRoute("/_layout/projects")({
  component: PublicProjects,
})

function PublicProjectsTable() {
  const queryClient = useQueryClient()
  const { page } = projectsSearchSchema.parse(Route.useSearch())
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, page }) })
  const [searchForText, setSearchForText] = useState()
  const [searchFor] = useDebounce(searchForText, 400)

  const {
    data: projects,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...getAllProjectsQueryOptions({ page, searchFor }),
    placeholderData: (prevData) => prevData,
  })

  const hasNextPage = !isPlaceholderData && projects?.data.length === PER_PAGE
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(
        getAllProjectsQueryOptions({
          page: page + 1,
          searchFor: searchForText,
        }),
      )
    }
  }, [page, queryClient, hasNextPage])

  const onSearchChange = (e: any) => {
    setSearchForText(e.target.value)
    // TODO: Search URL params
  }

  return (
    <>
      <Input
        mb={4}
        placeholder="Search..."
        width="33%"
        onChange={onSearchChange}
      />
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
                  <Td truncate maxWidth="80px">
                    {project.owner_account_name}
                  </Td>
                  <Td truncate maxWidth="150px">
                    <Link
                      as={RouterLink}
                      to={`/${project.owner_account_name}/${project.name}`}
                    >
                      {project.title}
                    </Link>
                  </Td>
                  <Td truncate maxWidth="150px">
                    <Link href={project.git_repo_url} isExternal>
                      <ExternalLinkIcon boxSize="1em" mx="2px" />{" "}
                      {project.git_repo_url}
                    </Link>
                  </Td>
                  <Td
                    color={!project.description ? "ui.dim" : "inherit"}
                    truncate
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

function PublicProjects() {
  return (
    <Container maxW={pageWidthNoSidebar}>
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={12}
        mb={4}
      >
        Browse all projects
      </Heading>
      <PublicProjectsTable />
    </Container>
  )
}
