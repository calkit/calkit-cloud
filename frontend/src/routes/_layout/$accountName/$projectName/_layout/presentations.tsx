import { ExternalLinkIcon } from "@chakra-ui/icons"
import {
  Badge,
  Box,
  Code,
  Flex,
  HStack,
  Heading,
  Icon,
  Link,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Link as RouterLink,
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router"
import { useRef, useState } from "react"
import { FiFile } from "react-icons/fi"
import { z } from "zod"

import type { Presentation } from "../../../../../client"
import { ProjectsService } from "../../../../../client"
import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import PageMenu from "../../../../../components/Common/PageMenu"
import PresentationView from "../../../../../components/Presentations/PresentationView"
import PdfAnnotator, {
  CommentList,
  commentToHighlight,
  type AnnotationHighlight,
} from "../../../../../components/Publications/PdfAnnotator"
import useAuth from "../../../../../hooks/useAuth"
import { useProjectPresentations } from "../../../../../hooks/useProject"

const presSearchSchema = z.object({
  path: z.string().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/presentations",
)({
  component: Presentations,
  validateSearch: (search) => presSearchSchema.parse(search),
})

interface PresInfoProps {
  presentation: Presentation
}

function PresInfo({ presentation }: PresInfoProps) {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  return (
    <Box bg={secBgColor} borderRadius="lg" p={3} h="fit-content">
      <Heading size="sm" mb={2}>
        Info
      </Heading>
      <Text fontSize="sm" mb={1}>
        <Text as="span" fontWeight="semibold">
          Title:
        </Text>{" "}
        <Text as="span" color="gray.500">
          {presentation.title ?? ""}
        </Text>
      </Text>
      <Text fontSize="sm" mb={1}>
        <Text as="span" fontWeight="semibold">
          Description:
        </Text>{" "}
        <Text as="span" color="gray.500">
          {presentation.description ?? ""}
        </Text>
      </Text>
      {presentation.path && (
        <Text fontSize="sm" mb={1}>
          <Text as="span" fontWeight="semibold">
            Path:
          </Text>{" "}
          <Link
            as={RouterLink}
            to="../files"
            search={{ path: presentation.path } as any}
          >
            {presentation.path}
          </Link>
        </Text>
      )}
      {presentation.type && (
        <Text fontSize="sm" mb={1}>
          <Text as="span" fontWeight="semibold">
            Type:
          </Text>{" "}
          <Badge>{presentation.type}</Badge>
        </Text>
      )}
      <Text fontSize="sm" mb={1}>
        <Text as="span" fontWeight="semibold">
          Pipeline stage:
        </Text>{" "}
        {presentation.stage ? (
          <Code fontSize="xs">{presentation.stage}</Code>
        ) : (
          <Text as="span" color="red.500">
            Not in pipeline
          </Text>
        )}
      </Text>
      {presentation.url && (
        <Box mt={2}>
          <Link isExternal href={String(presentation.url)} fontSize="sm">
            <Flex align="center" gap={1}>
              <Text>Download</Text>
              <Icon as={ExternalLinkIcon} />
            </Flex>
          </Link>
        </Box>
      )}
    </Box>
  )
}

function Presentations() {
  const { accountName, projectName } = Route.useParams()
  const layoutSearch = useSearch({
    from: "/_layout/$accountName/$projectName/_layout" as any,
    strict: false,
  }) as any
  const ref: string | undefined = layoutSearch?.ref
  const { presentationsRequest } = useProjectPresentations(
    accountName,
    projectName,
    ref,
  )
  const { path: selectedPath } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setSelectedPath = (p: string) =>
    navigate({ search: (prev) => ({ ...prev, path: p }) })
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showResolved, setShowResolved] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfScrollRef = useRef<(h: any) => void>(() => {})

  const selectedPres =
    presentationsRequest.data?.find((p) => p.path === selectedPath) ??
    presentationsRequest.data?.[0]

  const isPdf = selectedPres?.path?.toLowerCase().endsWith(".pdf") ?? false

  const commentsQuery = useQuery({
    queryKey: [
      "projects",
      accountName,
      projectName,
      "comments",
      "presentation",
      selectedPres?.path ?? "",
    ],
    queryFn: () =>
      ProjectsService.getProjectComments({
        ownerName: accountName,
        projectName,
        artifactType: "presentation",
        artifactPath: selectedPres!.path,
      }),
    enabled: !!selectedPres,
  })

  const resolveCommentMutation = useMutation({
    mutationFn: ({
      commentId,
      resolved,
    }: {
      commentId: string
      resolved: boolean
    }) =>
      ProjectsService.patchProjectComment({
        ownerName: accountName,
        projectName,
        commentId,
        requestBody: { resolved },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "projects",
          accountName,
          projectName,
          "comments",
          "presentation",
          selectedPres?.path,
        ],
      })
    },
  })

  const comments = commentsQuery.data ?? []
  const highlights: AnnotationHighlight[] = comments
    .map(commentToHighlight)
    .filter((h): h is AnnotationHighlight => h !== null)

  return (
    <>
      {presentationsRequest.isPending ? (
        <LoadingSpinner height="100vh" />
      ) : (
        <Flex height="100%" gap={0}>
          {/* Left: index */}
          <PageMenu>
            <Flex align="center" mb={2}>
              <Heading size="md">Presentations</Heading>
            </Flex>
            {presentationsRequest.data?.map((pres) => {
              const isSelected = pres.path === selectedPres?.path
              return (
                <Tooltip
                  key={pres.path}
                  label={pres.title}
                  openDelay={600}
                  placement="right"
                >
                  <HStack
                    px={1}
                    py={0.5}
                    borderRadius="md"
                    cursor="pointer"
                    fontWeight={isSelected ? "semibold" : "normal"}
                    _hover={{ color: "blue.500" }}
                    onClick={() => setSelectedPath(pres.path)}
                    spacing={1}
                  >
                    <Icon as={FiFile} flexShrink={0} />
                    <Text fontSize="sm" noOfLines={1}>
                      {pres.title}
                    </Text>
                  </HStack>
                </Tooltip>
              )
            })}
          </PageMenu>

          {/* Center: presentation viewer */}
          <Box flex={1} minW={0} mr={6} minH={0}>
            {selectedPres ? (
              isPdf && selectedPres.url ? (
                <Box height="82vh">
                  <PdfAnnotator
                    url={String(selectedPres.url)}
                    ownerName={accountName}
                    projectName={projectName}
                    publicationPath={selectedPres.path}
                    artifactType="presentation"
                    gitRef={ref}
                    showResolved={showResolved}
                    externalScrollRef={pdfScrollRef}
                  />
                </Box>
              ) : (
                <Box height="82vh" borderRadius="lg" overflow="hidden">
                  <PresentationView presentation={selectedPres} />
                </Box>
              )
            ) : (
              <Flex
                align="center"
                justify="center"
                height="300px"
                color="gray.500"
              >
                <Text>No presentations found</Text>
              </Flex>
            )}
          </Box>

          {/* Right: info + comments */}
          {selectedPres && (
            <Box w="280px" flexShrink={0} overflowY="auto">
              <VStack align="stretch" spacing={3}>
                <PresInfo presentation={selectedPres} />
                <CommentList
                  comments={comments}
                  highlights={highlights}
                  scrollToHighlight={(h) => pdfScrollRef.current(h)}
                  showResolved={showResolved}
                  onShowResolvedChange={setShowResolved}
                  currentUserId={user?.id}
                  ownerName={accountName}
                  projectName={projectName}
                  publicationPath={selectedPres.path}
                  artifactType="presentation"
                  gitRef={ref}
                  isLoading={commentsQuery.isPending}
                  resolvingId={
                    resolveCommentMutation.isPending
                      ? resolveCommentMutation.variables?.commentId
                      : undefined
                  }
                  onResolve={(id, resolved) =>
                    resolveCommentMutation.mutate({
                      commentId: id,
                      resolved,
                    })
                  }
                />
              </VStack>
            </Box>
          )}
        </Flex>
      )}
    </>
  )
}
