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
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { FiFile } from "react-icons/fi"
import { FaPlus } from "react-icons/fa"

import { ProjectsService, type Publication } from "../../../../../client"
import NewPublication from "../../../../../components/Publications/NewPublication"

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
  if (publication.path.endsWith(".pdf") && publication.content) {
    contentView = (
      <embed
        height="100%"
        width="100%"
        src={`data:application/pdf;base64,${publication.content}`}
      />
    )
  } else if (publication.path.endsWith(".png") && publication.content) {
    contentView = (
      <Image
        alt={publication.title}
        src={`data:image/png;base64,${publication.content}`}
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
        <Heading size={"md"} id={publication.path}>
          {publication.title}
        </Heading>
        <Text>{publication.description}</Text>
        <Box my={2} height={"80vh"} borderRadius={"lg"}>
          {contentView}
        </Box>
      </Box>
      {/* Information about the publication */}
      <Box width={"33%"}>
        <Box bg={secBgColor} borderRadius={"lg"} p={2} mb={2}>
          <Heading size="sm">Info</Heading>
          {publication.path ? <Text>Path: {publication.path}</Text> : ""}
          {publication.type ? (
            <Text>
              Type:<Badge>{publication.type}</Badge>
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
        <Box bg={secBgColor} borderRadius={"lg"} p={2}>
          <Heading size="sm">Comments</Heading>
          Coming soon!
        </Box>
      </Box>
    </Flex>
  )
}

function Publications() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
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
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
          {/* A nav bar at the left with a heading, upload menu and list of
           pubs */}
          <Box>
            <Box
              minW={"200px"}
              bg={secBgColor}
              borderRadius={"lg"}
              px={3}
              py={2}
              mr={4}
              position={"sticky"}
              top="55"
            >
              <Flex align={"center"} mb={1}>
                <Heading size={"md"}>Publications</Heading>
                <Menu>
                  <MenuButton
                    as={Button}
                    height={"25px"}
                    width={"9px"}
                    px={0.5}
                    ml={2}
                  >
                    <Icon as={FaPlus} fontSize={"xs"} />
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
                      <Text noOfLines={1}>
                        <Icon pt={1} as={FiFile} /> {pub.title}
                      </Text>
                    </Link>
                  ))
                : ""}
            </Box>
          </Box>
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
