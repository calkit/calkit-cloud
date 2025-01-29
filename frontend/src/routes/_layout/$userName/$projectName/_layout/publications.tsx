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
  Image,
  Alert,
  AlertIcon,
} from "@chakra-ui/react"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { FiFile } from "react-icons/fi"
import { FaPlus } from "react-icons/fa"

import { type Publication } from "../../../../../client"
import NewPublication from "../../../../../components/Publications/NewPublication"
import PageMenu from "../../../../../components/Common/PageMenu"
import useProject from "../../../../../hooks/useProject"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/publications",
)({
  component: Publications,
})

interface PubViewProps {
  publication: Publication
}

function PubView({ publication }: PubViewProps) {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")

  let contentView = <>Not set</>
  if (
    publication.path.endsWith(".pdf") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <embed
        height="100%"
        width="100%"
        type="application/pdf"
        src={
          publication.content
            ? `data:application/pdf;base64,${publication.content}`
            : String(publication.url)
        }
      />
    )
  } else if (
    publication.path.endsWith(".html") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <embed
        height="100%"
        width="100%"
        type="text/html"
        src={
          publication.url
            ? String(publication.url)
            : `data:text/html;base64,${publication.content}`
        }
      />
    )
  } else if (
    publication.path.endsWith(".png") &&
    (publication.content || publication.url)
  ) {
    contentView = (
      <Image
        alt={publication.title}
        src={
          publication.content
            ? `data:image/png;base64,${publication.content}`
            : String(publication.url)
        }
      />
    )
  } else {
    contentView = (
      <Alert mt={2} status="warning" borderRadius="xl">
        <AlertIcon />
        Cannot render content, either because it is empty or an unrecognized
        file type.
      </Alert>
    )
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
          {contentView}
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
  const { userName, projectName } = Route.useParams()
  const { publicationsRequest, userHasWriteAccess } = useProject(
    userName,
    projectName,
    false,
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
                  <PubView key={pub.path} publication={pub} />
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
