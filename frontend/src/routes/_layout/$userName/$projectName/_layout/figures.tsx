import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Textarea,
  Button,
  Icon,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Link,
  Code,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { useState } from "react"
import { FaPlus, FaRegFileImage, FaRegFilePdf } from "react-icons/fa"
import { FiFile } from "react-icons/fi"

import UploadFigure from "../../../../../components/Figures/UploadFigure"
import LabelAsFigure from "../../../../../components/Figures/FigureFromExisting"
import {
  ProjectsService,
  type Figure,
  type FigureCommentPost,
} from "../../../../../client"
import PageMenu from "../../../../../components/Common/PageMenu"
import useProject, { useProjectFigures } from "../../../../../hooks/useProject"
import useAuth from "../../../../../hooks/useAuth"
import FigureView from "../../../../../components/Figures/FigureView"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/figures",
)({
  component: ProjectFigures,
})

interface FigureCommentProps {
  figure: Figure
}

function FigureComments({ figure }: FigureCommentProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { userName, projectName } = Route.useParams()
  const { isPending, data: comments } = useQuery({
    queryKey: [userName, projectName, "figure-comments", figure.path],
    queryFn: () =>
      ProjectsService.getFigureComments({
        ownerName: userName,
        projectName: projectName,
        figurePath: figure.path,
      }),
  })
  const [commentInput, setCommentInput] = useState("")
  const handleInputChange = (val: any) => {
    setCommentInput(val.target.value)
  }
  const mutation = useMutation({
    mutationFn: (data: FigureCommentPost) =>
      ProjectsService.postFigureComment({
        ownerName: userName,
        projectName: projectName,
        requestBody: data,
      }),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [userName, projectName, "figure-comments", figure.path],
      })
    },
  })
  const onButtonClick = () => {
    mutation.mutate({ figure_path: figure.path, comment: commentInput })
    setCommentInput("")
  }
  const stringToColor = (str: string) => {
    let hash = 0
    str.split("").forEach((char) => {
      hash = char.charCodeAt(0) + ((hash << 5) - hash)
    })
    let color = "#"
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff
      color += value.toString(16).padStart(2, "0")
    }
    return color
  }

  return (
    <>
      <Heading size="s" mb={1}>
        Comments
      </Heading>
      <Box>
        {isPending ? (
          <Flex justify="center" align="center" height="100vh" width="full">
            <Spinner size="xl" color="ui.main" />
          </Flex>
        ) : (
          <Box
            p={2}
            my={2}
            maxH={"340px"}
            overflowY={"auto"}
            flexDirection={"column"}
            display={"flex"}
            borderWidth={"1px"}
            borderRadius={"md"}
          >
            {comments?.map((comment) => (
              <Box key={comment.id}>
                <Flex>
                  <Box mr={1}>
                    <Text
                      fontWeight={"bold"}
                      color={stringToColor(comment.user_email)}
                    >
                      {comment.user_github_username}:
                    </Text>
                  </Box>
                  <Box mr={1}>{comment.comment}</Box>
                </Flex>
              </Box>
            ))}
          </Box>
        )}
        {user ? (
          <>
            <Textarea
              mt={2}
              value={commentInput}
              onChange={handleInputChange}
              placeholder="Add a comment"
            />
            <Flex justifyItems={"end"} justifyContent={"end"}>
              <Button
                id={figure.path}
                my={2}
                isDisabled={commentInput === ""}
                isLoading={mutation.isPending}
                onClick={onButtonClick}
              >
                Submit
              </Button>
            </Flex>
          </>
        ) : (
          ""
        )}
      </Box>
    </>
  )
}

interface FigurePanelProps {
  figure: Figure
}

function FigurePanel({ figure }: FigurePanelProps) {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")

  return (
    <>
      <Flex pt={1} height={"100%"} width="full" mb={4}>
        <Box minW={"666px"} borderRadius="lg" bg={secBgColor} px={4} py={3}>
          <Heading size="md" mb={1}>
            {figure.title}
          </Heading>
          <Text>{figure.description}</Text>
          {figure.content || figure.url ? (
            <Box mt={3} mb={1}>
              <FigureView figure={figure} width="635px" />
            </Box>
          ) : (
            "No content found"
          )}
        </Box>
        <Box
          mx={4}
          width={"100%"}
          maxH={"550px"}
          py={3}
          px={4}
          borderRadius="lg"
          bg={secBgColor}
        >
          <Box mb={2}>
            <Heading size="sm" mb={0.5}>
              Info
            </Heading>
            <Text>
              Path:{" "}
              <Link
                as={RouterLink}
                to={"../files"}
                search={{ path: figure.path } as any}
              >
                {figure.path}
              </Link>
            </Text>
            {figure.stage ? (
              <Text>
                Stage: <Code>{figure.stage}</Code>
              </Text>
            ) : (
              ""
            )}
          </Box>
          <Box minW={"33%"} maxH={"550px"}>
            <FigureComments figure={figure} />
          </Box>
        </Box>
      </Flex>
    </>
  )
}

const getIcon = (figure: Figure) => {
  if (figure.path.endsWith(".png") || figure.path.endsWith(".jpg")) {
    return FaRegFileImage
  }
  if (figure.path.endsWith(".pdf")) {
    return FaRegFilePdf
  }
  return FiFile
}

function ProjectFigures() {
  const { userName, projectName } = Route.useParams()
  const { userHasWriteAccess } = useProject(userName, projectName)
  const { figuresRequest } = useProjectFigures(userName, projectName)
  const { isPending: figuresPending, data: figures } = figuresRequest
  const uploadFigureModal = useDisclosure()
  const labelFigureModal = useDisclosure()

  return (
    <>
      <Flex>
        {/* A bit of a nav bar with all the figures listed */}
        <PageMenu>
          <Flex align="center" mb={2} mt={1}>
            <Heading size="md">Figures</Heading>
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
                  <Link href={`#${figure.path}`}>
                    <Tooltip
                      label={`${figure.title}: ${figure.description}`}
                      openDelay={600}
                    >
                      <Text
                        isTruncated
                        noOfLines={1}
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        display="inline-block"
                        maxW="100%"
                      >
                        <Icon
                          height={"15px"}
                          pt={0.5}
                          mr={0.5}
                          as={getIcon(figure)}
                        />
                        {figure.title}
                      </Text>
                    </Tooltip>
                  </Link>
                </Box>
              ))
            : ""}
        </PageMenu>
        <>
          {figuresPending ? (
            <Flex justify="center" align="center" height={"100vh"} width="full">
              <Spinner size="xl" color="ui.main" />
            </Flex>
          ) : (
            <Box width="full" mt={-1} ml={-2} mb={2}>
              {figures?.map((figure) => (
                <Box id={figure.path} key={figure.title} mb={-1}>
                  <FigurePanel figure={figure} />
                </Box>
              ))}
            </Box>
          )}
        </>
      </Flex>
    </>
  )
}
