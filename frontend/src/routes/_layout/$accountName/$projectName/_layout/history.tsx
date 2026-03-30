import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Avatar,
  VStack,
  Badge,
  Code,
  useColorModeValue,
  Divider,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import PageMenu from "../../../../../components/Common/PageMenu"
import { getProjectHistory, searchProjectRefs } from "../../../../../lib/projectRefApi"

const historySearchSchema = z.object({
  ref: z.string().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/history",
)({
  component: History,
  validateSearch: (search) => historySearchSchema.parse(search),
})

function History() {
  const { accountName, projectName } = Route.useParams()
  const { ref } = Route.useSearch()
  const bgHover = useColorModeValue("gray.50", "gray.700")
  const borderColor = useColorModeValue("gray.200", "gray.600")

  const { data: commits = [], isPending: isLoadingHistory } = useQuery({
    queryKey: ["projects", accountName, projectName, "history", ref],
    queryFn: () =>
      getProjectHistory({
        ownerName: accountName,
        projectName: projectName,
        limit: 100,
      }),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ["projects", accountName, projectName, "refs", "branches"],
    queryFn: () =>
      searchProjectRefs({
        ownerName: accountName,
        projectName: projectName,
        q: undefined,
      }),
    select: (refs) => refs.filter((r) => r.type === "branch"),
  })

  const { data: tags = [] } = useQuery({
    queryKey: ["projects", accountName, projectName, "refs", "tags"],
    queryFn: () =>
      searchProjectRefs({
        ownerName: accountName,
        projectName: projectName,
        q: undefined,
      }),
    select: (refs) => refs.filter((r) => r.type === "tag"),
  })

  return (
    <Flex height="100%">
      <PageMenu>
        <Box mb={4}>
          <Heading size="md" mb={2}>
            Branches
          </Heading>
          {branches.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No branches found
            </Text>
          ) : (
            <VStack align="stretch" spacing={1}>
              {branches.map((branch) => (
                <Box
                  key={branch.name}
                  p={2}
                  borderRadius="md"
                  _hover={{ bg: bgHover }}
                  cursor="pointer"
                >
                  <Text fontWeight="bold" fontSize="sm">
                    {branch.name}
                  </Text>
                  {branch.message && (
                    <Text fontSize="xs" color="gray.600" noOfLines={1}>
                      {branch.message}
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          )}
        </Box>

        <Divider my={4} />

        <Box mb={4}>
          <Heading size="md" mb={2}>
            Tags
          </Heading>
          {tags.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No tags found
            </Text>
          ) : (
            <VStack align="stretch" spacing={1}>
              {tags.map((tag) => (
                <Box
                  key={tag.name}
                  p={2}
                  borderRadius="md"
                  _hover={{ bg: bgHover }}
                  cursor="pointer"
                >
                  <Flex align="center" gap={2}>
                    <Badge colorScheme="purple" fontSize="xs">
                      Tag
                    </Badge>
                    <Text fontWeight="bold" fontSize="sm">
                      {tag.name}
                    </Text>
                  </Flex>
                  {tag.message && (
                    <Text fontSize="xs" color="gray.600" noOfLines={1} mt={1}>
                      {tag.message}
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      </PageMenu>

      <Box flex={1} p={4} maxH="100%" overflowY="auto">
        <Heading size="md" mb={4}>Commit history</Heading>

        {isLoadingHistory ? (
          <Flex justify="center" align="center" height="400px">
            <Spinner size="lg" color="ui.main" />
          </Flex>
        ) : commits.length === 0 ? (
          <Text color="gray.500">No commits found</Text>
        ) : (
          <VStack align="stretch" spacing={3}>
            {commits.map((commit) => (
              <Box
                key={commit.hash}
                p={3}
                borderWidth={1}
                borderColor={borderColor}
                borderRadius="md"
                _hover={{ bg: bgHover }}
              >
                <Flex align="flex-start" gap={3} mb={2}>
                  <Avatar
                    name={commit.author}
                    size="sm"
                    src={`https://www.gravatar.com/avatar/${commit.author_email}?s=32&d=identicon`}
                  />
                  <VStack align="flex-start" spacing={0} flex={1}>
                    <Flex gap={2} align="center">
                      <Code fontSize="sm" colorScheme="gray">
                        {commit.short_hash}
                      </Code>
                      <Text fontWeight="bold" fontSize="sm" flex={1} noOfLines={1}>
                        {commit.summary}
                      </Text>
                    </Flex>
                    <Flex gap={2} fontSize="xs" color="gray.500" mt={1}>
                      <Text>{commit.author}</Text>
                      <Text>•</Text>
                      <Text>
                        {new Date(commit.timestamp).toLocaleDateString()} at{" "}
                        {new Date(commit.timestamp).toLocaleTimeString()}
                      </Text>
                    </Flex>
                  </VStack>
                </Flex>

                {commit.message.split("\n").length > 1 && (
                  <Box
                    pl={12}
                    pt={1}
                    borderLeftWidth={2}
                    borderLeftColor={borderColor}
                  >
                    <Text fontSize="xs" color="gray.600" whiteSpace="pre-wrap">
                      {commit.message.split("\n").slice(1).join("\n")}
                    </Text>
                  </Box>
                )}
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </Flex>
  )
}
