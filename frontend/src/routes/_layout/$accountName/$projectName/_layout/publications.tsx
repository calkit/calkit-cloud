import {
  Flex,
  Box,
  Heading,
  Icon,
  Text,
  Link,
  useColorModeValue,
  Menu,
  MenuButton,
  Button,
  MenuList,
  MenuItem,
  useDisclosure,
  Spinner,
  Badge,
  Code,
  HStack,
  VStack,
} from "@chakra-ui/react"
import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from "@tanstack/react-router"
import { FiFile } from "react-icons/fi"
import { FaPlus, FaSync, FaCodeBranch } from "react-icons/fa"
import { SiOverleaf } from "react-icons/si"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { z } from "zod"
import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import LoadingSpinner from "../../../../../components/Common/LoadingSpinner"
import { type Publication } from "../../../../../client"
import NewPublication from "../../../../../components/Publications/NewPublication"
import ImportOverleaf from "../../../../../components/Publications/ImportOverleaf"
import PageMenu from "../../../../../components/Common/PageMenu"
import useProject, {
  useProjectPublications,
} from "../../../../../hooks/useProject"
import PublicationView from "../../../../../components/Publications/PublicationView"
import PdfAnnotator, {
  CommentList,
  commentToHighlight,
  type AnnotationHighlight,
} from "../../../../../components/Publications/PdfAnnotator"
import { ProjectsService } from "../../../../../client"
import type { ApiError } from "../../../../../client/core/ApiError"
import useCustomToast from "../../../../../hooks/useCustomToast"
import { handleError } from "../../../../../lib/errors"
import { ArtifactCompareModal } from "../../../../../components/Common/ArtifactCompareModal"
import useAuth from "../../../../../hooks/useAuth"

const pubSearchSchema = z.object({
  path: z.string().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/publications",
)({
  component: Publications,
  validateSearch: (search) => pubSearchSchema.parse(search),
})

interface PubInfoProps {
  publication: Publication
  ownerName: string
  projectName: string
  userHasWriteAccess: boolean
}

function PubInfo({
  publication,
  ownerName,
  projectName,
  userHasWriteAccess,
}: PubInfoProps) {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const compareModal = useDisclosure()
  const showToast = useCustomToast()
  const queryClient = useQueryClient()

  const overleafSyncMutation = useMutation({
    mutationFn: () =>
      ProjectsService.postProjectOverleafSync({
        ownerName,
        projectName,
        requestBody: { path: publication.path },
      }),
    onSuccess: (data) => {
      let message = "Synced with Overleaf."
      if (data.commits_from_overleaf > 0)
        message = `Applied ${data.commits_from_overleaf} changes from Overleaf.`
      if (data.committed_overleaf)
        message += ` Updated Overleaf to rev ${data.overleaf_commit.slice(0, 7)}.`
      if (data.committed_project)
        message += ` Updated project to rev ${data.project_commit.slice(0, 7)}.`
      if (
        !data.commits_from_overleaf &&
        !data.committed_overleaf &&
        !data.committed_project
      )
        message += " No changes made."
      showToast("Success!", message, "success")
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "publications"],
      })
    },
    onError: (err: ApiError) => handleError(err, showToast),
  })

  return (
    <Box bg={secBgColor} borderRadius="lg" p={3} h="fit-content">
      <Heading size="sm" mb={2}>
        Info
      </Heading>
      {publication.path && (
        <Text fontSize="sm">
          Path:{" "}
          <Link
            as={RouterLink}
            to="../files"
            search={{ path: publication.path } as any}
          >
            {publication.path}
          </Link>
        </Text>
      )}
      {publication.type && (
        <Text fontSize="sm">
          Type: <Badge>{publication.type}</Badge>
        </Text>
      )}
      {publication.stage && (
        <Text fontSize="sm">
          Pipeline stage: <Code fontSize="xs">{publication.stage}</Code>
        </Text>
      )}
      {publication.overleaf?.project_id && (
        <Box mt={2}>
          <Flex align="center" gap={1}>
            <Link
              isExternal
              href={`https://www.overleaf.com/project/${publication.overleaf.project_id}`}
              fontSize="sm"
            >
              <Flex align="center" gap={1}>
                <Icon as={SiOverleaf} color="green.500" />
                <Text>View on Overleaf</Text>
                <Icon as={ExternalLinkIcon} />
              </Flex>
            </Link>
            {userHasWriteAccess && (
              <Button
                size="xs"
                onClick={() => overleafSyncMutation.mutate()}
                isLoading={overleafSyncMutation.isPending}
                rightIcon={<FaSync />}
                ml={1}
              >
                Sync
              </Button>
            )}
          </Flex>
        </Box>
      )}
      <Button mt={3} size="sm" onClick={compareModal.onOpen}>
        <Icon as={FaCodeBranch} mr={1} />
        Compare versions
      </Button>
      <ArtifactCompareModal
        isOpen={compareModal.isOpen}
        onClose={compareModal.onClose}
        ownerName={ownerName}
        projectName={projectName}
        path={publication.path}
        kind="publication"
      />
    </Box>
  )
}

function Publications() {
  const uploadPubModal = useDisclosure()
  const labelPubModal = useDisclosure()
  const newPubTemplateModal = useDisclosure()
  const overleafImportModal = useDisclosure()
  const { accountName, projectName } = Route.useParams()
  const { userHasWriteAccess } = useProject(accountName, projectName)
  const { publicationsRequest } = useProjectPublications(
    accountName,
    projectName,
  )
  const { path: selectedPath } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setSelectedPath = (p: string) =>
    navigate({ search: (prev) => ({ ...prev, path: p }) })
  const { user } = useAuth()
  const queryClient = useQueryClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfScrollRef = useRef<(h: any) => void>(() => {})

  const selectedPub =
    publicationsRequest.data?.find((p) => p.path === selectedPath) ??
    publicationsRequest.data?.[0]

  const isPdf = selectedPub?.path?.endsWith(".pdf") ?? false

  const commentsQuery = useQuery({
    queryKey: [
      "projects",
      accountName,
      projectName,
      "publication-comments",
      selectedPub?.path ?? "",
    ],
    queryFn: () =>
      ProjectsService.getPublicationComments({
        ownerName: accountName,
        projectName,
        publicationPath: selectedPub!.path,
      }),
    enabled: isPdf && !!selectedPub,
  })

  const deletePubCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      ProjectsService.deletePublicationComment({
        ownerName: accountName,
        projectName,
        commentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "projects",
          accountName,
          projectName,
          "publication-comments",
          selectedPub?.path,
        ],
      })
    },
  })

  const pdfComments = commentsQuery.data ?? []
  const pdfHighlights: AnnotationHighlight[] = pdfComments
    .map(commentToHighlight)
    .filter((h): h is AnnotationHighlight => h !== null)

  return (
    <>
      {publicationsRequest.isPending ? (
        <LoadingSpinner height="100vh" />
      ) : (
        <Flex height="100%" gap={0}>
          {/* Left: tree index */}
          <PageMenu>
            <Flex align="center" mb={2}>
              <Heading size="md">Publications</Heading>
              {userHasWriteAccess && (
                <>
                  <Menu>
                    <MenuButton
                      as={Button}
                      variant="primary"
                      height="25px"
                      width="9px"
                      px={1}
                      ml={2}
                    >
                      <Icon as={FaPlus} fontSize="xs" />
                    </MenuButton>
                    <MenuList>
                      <MenuItem onClick={newPubTemplateModal.onOpen}>
                        Create new from template
                      </MenuItem>
                      <MenuItem onClick={overleafImportModal.onOpen}>
                        Import from Overleaf
                      </MenuItem>
                      <MenuItem onClick={uploadPubModal.onOpen}>
                        Upload
                      </MenuItem>
                      <MenuItem onClick={labelPubModal.onOpen}>
                        Label existing file
                      </MenuItem>
                    </MenuList>
                  </Menu>
                  <NewPublication
                    isOpen={newPubTemplateModal.isOpen}
                    onClose={newPubTemplateModal.onClose}
                    variant="template"
                  />
                  <ImportOverleaf
                    isOpen={overleafImportModal.isOpen}
                    onClose={overleafImportModal.onClose}
                  />
                  <NewPublication
                    isOpen={uploadPubModal.isOpen}
                    onClose={uploadPubModal.onClose}
                    variant="upload"
                  />
                  <NewPublication
                    isOpen={labelPubModal.isOpen}
                    onClose={labelPubModal.onClose}
                    variant="label"
                  />
                </>
              )}
            </Flex>
            {publicationsRequest.data?.map((pub) => {
              const isSelected = pub.path === selectedPub?.path
              return (
                <HStack
                  key={pub.path}
                  px={1}
                  py={0.5}
                  borderRadius="md"
                  cursor="pointer"
                  fontWeight={isSelected ? "semibold" : "normal"}
                  _hover={{ color: "blue.500" }}
                  onClick={() => setSelectedPath(pub.path)}
                  spacing={1}
                >
                  <Icon as={FiFile} flexShrink={0} />
                  <Text fontSize="sm" noOfLines={1}>
                    {pub.title}
                  </Text>
                </HStack>
              )
            })}
          </PageMenu>

          {/* Center: publication viewer */}
          <Box flex={1} minW={0} mx={4} minH={0}>
            {selectedPub ? (
              <>
                <Heading size="md" mb={1}>
                  {selectedPub.title}
                </Heading>
                {selectedPub.description && (
                  <Text fontSize="sm" color="gray.500" mb={2}>
                    {selectedPub.description}
                  </Text>
                )}
                {isPdf && selectedPub.url ? (
                  <Box height="80vh">
                    <PdfAnnotator
                      url={String(selectedPub.url)}
                      ownerName={accountName}
                      projectName={projectName}
                      publicationPath={selectedPub.path}
                      externalScrollRef={pdfScrollRef}
                    />
                  </Box>
                ) : (
                  <Box height="80vh" borderRadius="lg" overflow="hidden">
                    <PublicationView publication={selectedPub} />
                  </Box>
                )}
              </>
            ) : (
              <Flex
                align="center"
                justify="center"
                height="300px"
                color="gray.500"
              >
                <Text>No publications found</Text>
              </Flex>
            )}
          </Box>

          {/* Right: info + compare + comments */}
          {selectedPub && (
            <Box w="280px" flexShrink={0} overflowY="auto">
              <VStack align="stretch" spacing={3}>
                <PubInfo
                  publication={selectedPub}
                  ownerName={accountName}
                  projectName={projectName}
                  userHasWriteAccess={userHasWriteAccess}
                />
                {isPdf && (
                  <CommentList
                    comments={pdfComments}
                    highlights={pdfHighlights}
                    scrollToHighlight={(h) => pdfScrollRef.current(h)}
                    currentUserId={user?.id}
                    onDelete={(id) => deletePubCommentMutation.mutate(id)}
                  />
                )}
              </VStack>
            </Box>
          )}
        </Flex>
      )}
    </>
  )
}
