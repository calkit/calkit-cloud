import {
  Box,
  Container,
  Flex,
  Heading,
  Link,
  SkeletonText,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Link as RouterLink } from "@tanstack/react-router"

import { AccountsService, ProjectsService } from "../../../client"
import NotFound from "../../../components/Common/NotFound"
import { ExternalLinkIcon } from "@chakra-ui/icons"

export const Route = createFileRoute("/_layout/$accountName/")({
  component: AccountPage,
})

function UsersTable() {
  // Fetch users for the org
  const { accountName } = Route.useParams()
  return <></>
}

function ProjectsTable() {
  const { accountName } = Route.useParams()
  const { isPending, data: projects } = useQuery({
    queryKey: ["projects", accountName],
    queryFn: () => ProjectsService.getProjects({ ownerName: accountName }),
  })

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>GitHub URL</Th>
              <Th>Description</Th>
            </Tr>
          </Thead>
          {isPending ? (
            <Tbody>
              <Tr>
                {new Array(3).fill(null).map((_, index) => (
                  <Td key={index}>
                    <SkeletonText noOfLines={1} paddingBlock="16px" />
                  </Td>
                ))}
              </Tr>
            </Tbody>
          ) : (
            <Tbody>
              {projects?.data.map((project) => (
                <Tr key={project.id}>
                  <Td isTruncated maxWidth="150px">
                    <Link
                      as={RouterLink}
                      to={`/${project.owner_account_name}/${project.name}`}
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
    </>
  )
}

function AccountPage() {
  // Fetch account information
  const { accountName } = Route.useParams()
  const { isPending, data: account } = useQuery({
    queryKey: ["accounts", accountName],
    queryFn: () => AccountsService.getAccount({ accountName }),
    retry: (failureCount, error: any) => {
      const status =
        error?.status ?? error?.response?.status ?? error?.statusCode ?? null
      // Don't retry on 404, otherwise allow up to 3 attempts
      if (status === 404) return false
      return failureCount < 3
    },
  })

  return (
    <Box>
      {isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : !account?.name ? (
        <>
          <NotFound />
        </>
      ) : (
        <Container maxW={{ base: "90%", md: "60%" }} pb={10}>
          <Heading
            size="lg"
            textAlign={{ base: "center", md: "left" }}
            pt={12}
            mb={4}
          >
            {account.display_name}
          </Heading>
          {/* Add a users table if this is an org */}
          {account.kind === "org" && account.role ? (
            <>
              <Heading size="md" mb={4}>
                Users
              </Heading>
              <UsersTable />
            </>
          ) : (
            ""
          )}
          {/* Add a projects table */}
          <Heading size="md" mb={4}>
            Projects
          </Heading>
          <ProjectsTable />
        </Container>
      )}
    </Box>
  )
}
