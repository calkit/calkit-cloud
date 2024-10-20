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
import { useQuery } from "@tanstack/react-query"
import { FiFile } from "react-icons/fi"
import { FaPlus } from "react-icons/fa"

import { ProjectsService, type Publication } from "../../../../../client"
import NewPublication from "../../../../../components/Publications/NewPublication"
import PageMenu from "../../../../../components/Common/PageMenu"

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
      <Box width={"66%"} mr={4}>
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
        <Box bg={secBgColor} borderRadius="lg" p={2} mb={2}>
          <Heading size="sm">Info</Heading>
          {publication.path ? (
            <Text>
              Path:{" "}
              <Link
                as={RouterLink}
                to="../files"
                search={{ path: publication.path }}
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
              Workflow stage: <Code>{publication.stage}</Code>
            </Text>
          ) : (
            ""
          )}
        </Box>
        {/* Comments */}
        <Box bg={secBgColor} borderRadius="lg" p={2}>
          <Heading size="sm">Comments</Heading>
          Coming soon!
        </Box>
      </Box>
    </Flex>
  )
}

function Publications() {
  const uploadPubModal = useDisclosure()
  const labelPubModal = useDisclosure()
  const { userName, projectName } = Route.useParams()
  const pubsQuery = useQuery({
    queryKey: ["projects", userName, projectName, "publications"],
    queryFn: () =>
      ProjectsService.getProjectPublications({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {pubsQuery.isPending ? (
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
                  <MenuItem onClick={uploadPubModal.onOpen}>
                    Upload new publication
                  </MenuItem>
                  <MenuItem onClick={labelPubModal.onOpen}>
                    Label existing file as publication
                  </MenuItem>
                </MenuList>
              </Menu>
              <NewPublication
                isOpen={uploadPubModal.isOpen}
                onClose={uploadPubModal.onClose}
                uploadFile={true}
              />
              <NewPublication
                isOpen={labelPubModal.isOpen}
                onClose={labelPubModal.onClose}
                uploadFile={false}
              />
            </Flex>
            {/* Iterate over all publications to create an anchor link for
             each */}
            {pubsQuery.data
              ? pubsQuery.data.map((pub) => (
                  <Link key={pub.path} href={`#${pub.path}`}>
                    <Text
                      isTruncated
                      noOfLines={1}
                      whiteSpace="nowrap"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      display="inline-block"
                      maxW="100%"
                    >
                      <Icon pt={1} as={FiFile} /> {pub.title}
                    </Text>
                  </Link>
                ))
              : ""}
          </PageMenu>
          {/* A box to the right that iterates over all figures, adding a view
           for the content, info, and comments */}
          <Box width={"100%"}>
            {pubsQuery.data ? (
              <>
                {pubsQuery.data.map((pub) => (
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
