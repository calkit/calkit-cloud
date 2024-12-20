import {
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
  Text,
  Tooltip,
  Tr,
} from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  useNavigate,
  Link as RouterLink,
} from "@tanstack/react-router"
import { z } from "zod"
import { useEffect } from "react"

import { pageWidthNoSidebar } from "../../utils"
import { DatasetsService } from "../../client"

const datasetsSearchSchema = z.object({
  page: z.number().catch(1),
})

const PER_PAGE = 10

function getAllDatasetsQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      DatasetsService.getDatasets({
        offset: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
      }),
    queryKey: ["datasets-all", { page }],
  }
}

export const Route = createFileRoute("/_layout/datasets")({
  component: PublicDatasets,
})

function PublicDatasetsTable() {
  const queryClient = useQueryClient()
  const { page } = datasetsSearchSchema.parse(Route.useSearch())
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, page }) })

  const {
    data: datasets,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...getAllDatasetsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

  const hasNextPage = !isPlaceholderData && datasets?.data.length === PER_PAGE
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getAllDatasetsQueryOptions({ page: page + 1 }))
    }
  }, [page, queryClient, hasNextPage])

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th>Owner</Th>
              <Th>Project</Th>
              <Th>Path</Th>
              <Th>Title</Th>
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
              {datasets?.data.map((dataset, index) => (
                <Tr key={index} opacity={isPlaceholderData ? 0.5 : 1}>
                  <Td isTruncated maxWidth="80px">
                    {dataset.project.owner_account_name}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Link
                      as={RouterLink}
                      to={`/${dataset.project.owner_account_name}/${dataset.project.name}/datasets`}
                    >
                      <Tooltip openDelay={600} label={dataset.project.title}>
                        <Text isTruncated>{dataset.project.title}</Text>
                      </Tooltip>
                    </Link>
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Link
                      as={RouterLink}
                      to={`/${dataset.project.owner_account_name}/${dataset.project.name}/datasets`}
                    >
                      <Tooltip label={dataset.path} openDelay={600}>
                        <Text isTruncated>{dataset.path}</Text>
                      </Tooltip>
                    </Link>
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    <Link
                      as={RouterLink}
                      to={`/${dataset.project.owner_account_name}/${dataset.project.name}/datasets`}
                    >
                      {dataset.title}
                    </Link>
                  </Td>
                  <Td
                    color={!dataset.description ? "ui.dim" : "inherit"}
                    isTruncated
                    maxWidth="250px"
                  >
                    {dataset.description ? (
                      <Tooltip openDelay={600} label={dataset.description}>
                        <Text isTruncated>{dataset.description}</Text>
                      </Tooltip>
                    ) : (
                      "N/A"
                    )}
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

function PublicDatasets() {
  return (
    <Container maxW={pageWidthNoSidebar} pb={10}>
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={12}
        mb={4}
      >
        Browse all datasets
      </Heading>
      <PublicDatasetsTable />
    </Container>
  )
}
