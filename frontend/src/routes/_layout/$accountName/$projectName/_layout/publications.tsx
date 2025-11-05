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
  IconButton,
} from "@chakra-ui/react"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { FiFile } from "react-icons/fi"
import { FaPlus, FaSync } from "react-icons/fa"
import { SiOverleaf } from "react-icons/si"
import { ExternalLinkIcon } from "@chakra-ui/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { type Publication } from "../../../../../client"
import NewPublication from "../../../../../components/Publications/NewPublication"
import ImportOverleaf from "../../../../../components/Publications/ImportOverleaf"
import PageMenu from "../../../../../components/Common/PageMenu"
import useProject, {
  useProjectPublications,
} from "../../../../../hooks/useProject"
import PublicationView from "../../../../../components/Publications/PublicationView"
import { ProjectsService } from "../../../../../client"
import type { ApiError } from "../../../../../client/core/ApiError"
import useCustomToast from "../../../../../hooks/useCustomToast"
import { handleError } from "../../../../../lib/errors"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/publications",
)({
  component: Publications,
})

interface PubViewProps {
  publication: Publication
  userHasWriteAccess: boolean
}

function PubView({ publication, userHasWriteAccess }: PubViewProps) {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { accountName, projectName } = Route.useParams()
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const overleafSyncMutation = useMutation({
    mutationFn: () =>
      ProjectsService.postProjectOverleafSync({
        ownerName: accountName,
        projectName: projectName,
        requestBody: { path: publication.path },
      }),
    onSuccess: (data) => {
      let message: string = "Synced with Overleaf."
      if (data.commits_from_overleaf > 0) {
        message = `Applied ${data.commits_from_overleaf} changes from Overleaf.`
      }
      if (data.committed_overleaf) {
        message += ` Updated Overleaf to rev ${data.overleaf_commit.slice(0, 7)}.`
      }
      if (data.committed_project) {
        message += ` Updated project to rev ${data.project_commit.slice(0, 7)}.`
      }
      if (
        data.commits_from_overleaf === 0 &&
        !data.committed_overleaf &&
        !data.committed_project
      ) {
        message += " No changes made."
      }
      showToast("Success!", message, "success")
      queryClient.invalidateQueries({
        queryKey: ["projects", accountName, projectName, "publications"],
      })
    },
    onError: (err: ApiError) => {
      console.log("Error", err)
      handleError(err, showToast)
    },
  })
  const onClickSync = () => {
    overleafSyncMutation.mutate()
  }

  return (
    <Flex mb={2}>
      {/* A heading and content view */}
      <Box width={"66%"} mr={4} bg={secBgColor} borderRadius="lg" px={3} py={2}>
        <Heading size="md" id={publication.path}>
          {publication.title}
        </Heading>
        <Text>{publication.description}</Text>
        <Box my={2} height={"80vh"} borderRadius="lg">
          <PublicationView publication={publication} />
        </Box>
      </Box>
      {/* Information about the publication */}
      <Box width={"33%"}>
        <Box bg={secBgColor} borderRadius="lg" p={2} mb={2} px={3}>
          <Heading size="sm">Info</Heading>
          {publication.path ? (
            <Text>
              Path:{" "}
              <Link
                as={RouterLink}
                to="../files"
                search={{ path: publication.path } as any}
              >
                {publication.path}
              </Link>
            </Text>
          ) : (
            ""
          )}
          {publication.type ? (
            <Text>
              Type: <Badge>{publication.type}</Badge>
            </Text>
          ) : (
            ""
          )}
          {publication.stage ? (
            <Text>
              Pipeline stage: <Code>{publication.stage}</Code>
            </Text>
          ) : (
            ""
          )}
          {publication.overleaf?.project_id ? (
            <>
              <Link
                isExternal
                href={`https://www.overleaf.com/project/${publication.overleaf.project_id}`}
              >
                <Flex align={"center"}>
                  <Icon as={SiOverleaf} color="green.500" />
                  <Text ml={0.5}>View on Overleaf</Text>
                  <Icon as={ExternalLinkIcon} ml={0.5} />
                </Flex>
              </Link>
              <Flex align="center">
                {userHasWriteAccess ? (
                  <>
                    <Text>Sync</Text>
                    <IconButton
                      size="xs"
                      aria-label="Sync with Overleaf"
                      icon={<FaSync />}
                      ml={1}
                      onClick={onClickSync}
                      isLoading={overleafSyncMutation.isPending}
                    />
                  </>
                ) : (
                  ""
                )}
              </Flex>
            </>
          ) : (
            ""
          )}
        </Box>
        {/* TODO: Add ability to comment on a publication */}
      </Box>
    </Flex>
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

  return (
    <>
      {publicationsRequest.isPending ? (
        <Flex justify="center" align="center" height={"100vh"} width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          {/* A nav bar at the left with a heading, upload menu and list of
           pubs */}
          <PageMenu>
            <Flex align="center" mb={2}>
              <Heading size="md">Publications</Heading>
              {userHasWriteAccess ? (
                <>
                  <Menu>
                    <MenuButton
                      as={Button}
                      variant="primary"
                      height={"25px"}
                      width={"9px"}
                      px={1}
                      ml={2}
                    >
                      <Icon as={FaPlus} fontSize="xs" />
                    </MenuButton>
                    <MenuList>
                      <MenuItem onClick={newPubTemplateModal.onOpen}>
                        Create new publication from template
                      </MenuItem>
                      <MenuItem onClick={overleafImportModal.onOpen}>
                        Import from Overleaf
                      </MenuItem>
                      <MenuItem onClick={uploadPubModal.onOpen}>
                        Upload new publication
                      </MenuItem>
                      <MenuItem onClick={labelPubModal.onOpen}>
                        Label existing file as publication
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
              ) : (
                ""
              )}
            </Flex>
            {/* Iterate over all publications to create an anchor link for
             each */}
            {publicationsRequest.data
              ? publicationsRequest.data.map((pub) => (
                  <Link key={pub.path} href={`#${pub.path}`}>
                    <Text
                      isTruncated
                      noOfLines={1}
                      whiteSpace="nowrap"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      display="inline-block"
                      width="100%"
                    >
                      <Icon pt={1} mr={-0.5} as={FiFile} /> {pub.title}
                    </Text>
                  </Link>
                ))
              : ""}
          </PageMenu>
          {/* A box to the right that iterates over all figures, adding a view
           for the content, info, and comments */}
          <Box width={"100%"} ml={-2}>
            {publicationsRequest.data ? (
              <>
                {publicationsRequest.data.map((pub) => (
                  <PubView
                    key={pub.path}
                    publication={pub}
                    userHasWriteAccess={userHasWriteAccess}
                  />
                ))}
              </>
            ) : (
              ""
            )}
          </Box>
        </Flex>
      )}
    </>
  )
}
