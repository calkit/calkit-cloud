import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Button,
  Icon,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  SimpleGrid,
  useColorModeValue,
  Image,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FaPlus, FaRegFileImage, FaRegFilePdf } from "react-icons/fa"
import { FiFile } from "react-icons/fi"
import { z } from "zod"

import UploadFigure from "../../../../../components/Figures/UploadFigure"
import LabelAsFigure from "../../../../../components/Figures/FigureFromExisting"
import { type Figure } from "../../../../../client"
import PageMenu from "../../../../../components/Common/PageMenu"
import useProject from "../../../../../hooks/useProject"
import { getProjectFiguresAtRef } from "../../../../../lib/projectRefApi"
import { ArtifactCompareModal } from "../../../../../components/Common/ArtifactCompareModal"

const figuresSearchSchema = z.object({
  ref: z.string().optional(),
  compareRef: z.string().optional(),
})

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/_layout/figures",
)({
  component: ProjectFigures,
  validateSearch: (search) => figuresSearchSchema.parse(search),
})

const getIcon = (figure: Figure) => {
  if (figure.path.endsWith(".png") || figure.path.endsWith(".jpg")) {
    return FaRegFileImage
  }
  if (figure.path.endsWith(".pdf")) {
    return FaRegFilePdf
  }
  return FiFile
}

/** Small thumbnail card for a figure in the gallery. */
function FigureThumbnail({
  figure,
  onClick,
}: {
  figure: Figure
  onClick: () => void
}) {
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const bg = useColorModeValue("white", "gray.800")
  const hoverBg = useColorModeValue("gray.50", "gray.700")

  const renderThumb = () => {
    if (
      (figure.path.endsWith(".png") ||
        figure.path.endsWith(".jpg") ||
        figure.path.endsWith(".jpeg") ||
        figure.path.endsWith(".svg")) &&
      (figure.content || figure.url)
    ) {
      const ext = figure.path.split(".").pop() ?? "png"
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        svg: "image/svg+xml",
      }
      const mime = mimeMap[ext] ?? "image/png"
      return (
        <Image
          src={
            figure.content
              ? `data:${mime};base64,${figure.content}`
              : String(figure.url)
          }
          alt={figure.title}
          objectFit="contain"
          width="100%"
          height="140px"
        />
      )
    }
    return (
      <Flex
        height="140px"
        align="center"
        justify="center"
        color="gray.400"
        fontSize="3xl"
      >
        <Icon as={getIcon(figure)} />
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
      <Box overflow="hidden" bg="gray.50">
        {renderThumb()}
      </Box>
      <Box p={3}>
        <Text fontWeight="semibold" fontSize="sm" noOfLines={1}>
          {figure.title}
        </Text>
        {figure.description && (
          <Text fontSize="xs" color="gray.500" noOfLines={2} mt={0.5}>
            {figure.description}
          </Text>
        )}
      </Box>
    </Box>
  )
}

function ProjectFigures() {
  const { accountName, projectName } = Route.useParams()
  const { ref } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { userHasWriteAccess } = useProject(accountName, projectName)
  const [selectedFigure, setSelectedFigure] = useState<Figure | null>(null)
  const compareModal = useDisclosure()

  const { isPending: figuresPending, data: figures } = useQuery({
    queryKey: ["projects", accountName, projectName, "figures", ref],
    queryFn: () =>
      getProjectFiguresAtRef({
        ownerName: accountName,
        projectName: projectName,
        ref,
      }),
  })
  const uploadFigureModal = useDisclosure()
  const labelFigureModal = useDisclosure()

  const openFigure = (figure: Figure) => {
    setSelectedFigure(figure)
    compareModal.onOpen()
  }

  return (
    <>
      <Flex>
        <PageMenu>
          <Flex align="center" mb={2} mt={1}>
            <Heading size="md">Figures</Heading>
            {userHasWriteAccess && !ref ? (
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
                    <MenuItem onClick={uploadFigureModal.onOpen}>
                      Upload new figure
                    </MenuItem>
                    <MenuItem onClick={labelFigureModal.onOpen}>
                      Label existing file as figure
                    </MenuItem>
                  </MenuList>
                </Menu>
                <UploadFigure
                  isOpen={uploadFigureModal.isOpen}
                  onClose={uploadFigureModal.onClose}
                />
                <LabelAsFigure
                  isOpen={labelFigureModal.isOpen}
                  onClose={labelFigureModal.onClose}
                />
              </>
            ) : (
              ""
            )}
          </Flex>
          {figures
            ? figures.map((figure) => (
                <Box key={figure.path}>
                  <Text
                    fontSize="sm"
                    cursor="pointer"
                    _hover={{ color: "blue.500" }}
                    noOfLines={1}
                    onClick={() => openFigure(figure)}
                  >
                    <Icon
                      height={"15px"}
                      pt={0.5}
                      mr={0.5}
                      as={getIcon(figure)}
                    />
                    {figure.title}
                  </Text>
                </Box>
              ))
            : ""}
        </PageMenu>

        {figuresPending ? (
          <Flex justify="center" align="center" height={"100vh"} width="full">
            <Spinner size="xl" color="ui.main" />
          </Flex>
        ) : (
          <Box flex={1} p={4} overflowY="auto">
            {!figures || figures.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                height="300px"
                color="gray.500"
              >
                <Icon as={FaRegFileImage} fontSize="4xl" mb={3} />
                <Text>No figures found</Text>
                {ref && (
                  <Button
                    mt={3}
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate({ search: {} })}
                  >
                    Clear ref filter
                  </Button>
                )}
              </Flex>
            ) : (
              <SimpleGrid columns={{ base: 2, md: 3, lg: 4, xl: 5 }} spacing={4}>
                {figures.map((figure) => (
                  <FigureThumbnail
                    key={figure.path}
                    figure={figure}
                    onClick={() => openFigure(figure)}
                  />
                ))}
              </SimpleGrid>
            )}
          </Box>
        )}
      </Flex>

      {selectedFigure && (
        <ArtifactCompareModal
          isOpen={compareModal.isOpen}
          onClose={() => {
            compareModal.onClose()
            setSelectedFigure(null)
          }}
          ownerName={accountName}
          projectName={projectName}
          path={selectedFigure.path}
          kind="figure"
          initialRef={ref}
        />
      )}
    </>
  )
}
