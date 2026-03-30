import {
  Flex,
  Box,
  Heading,
  Icon,
  Text,
  useColorModeValue,
  Menu,
  MenuButton,
  Button,
  MenuList,
  MenuItem,
  useDisclosure,
  Spinner,
  SimpleGrid,
  Image,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { FiFile } from "react-icons/fi"
import { FaPlus } from "react-icons/fa"
import { SiOverleaf } from "react-icons/si"
import { useState } from "react"

import { type Publication } from "../../../../../client"
import NewPublication from "../../../../../components/Publications/NewPublication"
import ImportOverleaf from "../../../../../components/Publications/ImportOverleaf"
import PageMenu from "../../../../../components/Common/PageMenu"
import useProject, {
  useProjectPublications,
} from "../../../../../hooks/useProject"
import { ArtifactCompareModal } from "../../../../../components/Common/ArtifactCompareModal"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/publications",
)({
  component: Publications,
})

/** Small thumbnail card for a publication in the gallery. */
function PublicationThumbnail({
  publication,
  onClick,
}: {
  publication: Publication
  onClick: () => void
}) {
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const bg = useColorModeValue("white", "gray.800")
  const hoverBg = useColorModeValue("gray.50", "gray.700")

  const renderThumb = () => {
    if (publication.path.endsWith(".png") && (publication.content || publication.url)) {
      return (
        <Image
          src={
            publication.content
              ? `data:image/png;base64,${publication.content}`
              : String(publication.url)
          }
          alt={publication.title}
          objectFit="contain"
          width="100%"
          height="140px"
        />
      )
    }
    const isPdf = publication.path.endsWith(".pdf")
    return (
      <Flex
        height="140px"
        align="center"
        justify="center"
        bg={isPdf ? "red.50" : "gray.50"}
        color={isPdf ? "red.400" : "gray.400"}
        fontSize="3xl"
      >
        <Icon as={FiFile} />
      </Flex>
    )
  }

  return (
    <Box
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="lg"
      overflow="hidden"
      bg={bg}
      cursor="pointer"
      _hover={{ bg: hoverBg, shadow: "md" }}
      onClick={onClick}
      transition="all 0.15s"
    >
      {renderThumb()}
      <Box p={3}>
        <Flex align="center" gap={1} mb={0.5}>
          {publication.overleaf?.project_id && (
            <Icon as={SiOverleaf} color="green.500" fontSize="xs" />
          )}
          <Text fontWeight="semibold" fontSize="sm" noOfLines={1}>
            {publication.title}
          </Text>
        </Flex>
        {publication.description && (
          <Text fontSize="xs" color="gray.500" noOfLines={2} mt={0.5}>
            {publication.description}
          </Text>
        )}
      </Box>
    </Box>
  )
}

function Publications() {
  const uploadPubModal = useDisclosure()
  const labelPubModal = useDisclosure()
  const newPubTemplateModal = useDisclosure()
  const overleafImportModal = useDisclosure()
  const compareModal = useDisclosure()
  const { accountName, projectName } = Route.useParams()
  const { userHasWriteAccess } = useProject(accountName, projectName)
  const { publicationsRequest } = useProjectPublications(
    accountName,
    projectName,
  )
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null)

  const openPub = (pub: Publication) => {
    setSelectedPub(pub)
    compareModal.onOpen()
  }

  return (
    <>
      {publicationsRequest.isPending ? (
        <Flex justify="center" align="center" height={"100vh"} width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex>
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
            {publicationsRequest.data?.map((pub) => (
              <Text
                key={pub.path}
                fontSize="sm"
                cursor="pointer"
                _hover={{ color: "blue.500" }}
                noOfLines={1}
                onClick={() => openPub(pub)}
              >
                <Icon pt={1} mr={-0.5} as={FiFile} /> {pub.title}
              </Text>
            ))}
          </PageMenu>

          <Box flex={1} p={4} overflowY="auto">
            {!publicationsRequest.data ||
            publicationsRequest.data.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                height="300px"
                color="gray.500"
              >
                <Icon as={FiFile} fontSize="4xl" mb={3} />
                <Text>No publications found</Text>
              </Flex>
            ) : (
              <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
                {publicationsRequest.data.map((pub) => (
                  <PublicationThumbnail
                    key={pub.path}
                    publication={pub}
                    onClick={() => openPub(pub)}
                  />
                ))}
              </SimpleGrid>
            )}
          </Box>
        </Flex>
      )}

      {selectedPub && (
        <ArtifactCompareModal
          isOpen={compareModal.isOpen}
          onClose={() => {
            compareModal.onClose()
            setSelectedPub(null)
          }}
          ownerName={accountName}
          projectName={projectName}
          path={selectedPub.path}
          kind="publication"
        />
      )}
    </>
  )
}
