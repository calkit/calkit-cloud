import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Textarea,
  Button,
  Image,
  Icon,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
  Link,
} from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
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

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/figures",
)({
  component: ProjectFigures,
})

interface FigureProps {
  figure: Figure
}

function FigureComments({ figure }: FigureProps) {
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
  const handleInputChange = (val) => {
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
            maxH={"400px"}
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
      </Box>
    </>
  )
}

function FigureView({ figure }: FigureProps) {
  let figView = <>Not set</>
  if (figure.path.endsWith(".pdf")) {
    figView = (
      <Box height="530px" width="635px">
        <embed
          height="100%"
          width="100%"
          src={`data:application/pdf;base64,${figure.content}`}
        />
      </Box>
    )
  } else if (figure.path.endsWith(".png")) {
    figView = (
      <Box width="635px">
        <Image
          alt={figure.title}
          src={`data:image/png;base64,${figure.content}`}
        />
      </Box>
    )
  } else {
    figView = <Text>Cannot render this type of figure</Text>
  }

  return (
    <>
      <Heading size="sm" mb={1} pt={1}>
        {figure.title}
      </Heading>
      <Text>{figure.description}</Text>
      {figure.content ? (
        <Flex my={3}>
          {figView}
          <Box mx={4} width={"50%"} maxH={"550px"}>
            <FigureComments figure={figure} />
          </Box>
        </Flex>
      ) : (
        "Cannot render content"
      )}
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
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { userName, projectName } = Route.useParams()
  const { isPending: figuresPending, data: figures } = useQuery({
    queryKey: ["projects", userName, projectName, "figures"],
    queryFn: () =>
      ProjectsService.getProjectFigures({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const uploadFigureModal = useDisclosure()
  const labelFigureModal = useDisclosure()

  return (
    <>
      <Flex>
        <Box>
          <Flex mb={2}>
            <Heading size="md">Figures</Heading>
            <Menu>
              <MenuButton>
                <Button
                  variant="primary"
                  height={"25px"}
                  width={"9px"}
                  px={1}
                  ml={2}
                >
                  <Icon as={FaPlus} fontSize={"sm"} />
                </Button>
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
          </Flex>
          <Box
            minW={"200px"}
            px={0}
            py={2}
            mr={6}
            mt={0}
            pl={3}
            pb={2}
            borderRadius={"lg"}
            bg={secBgColor}
            borderWidth={0}
            position={"sticky"}
            top="55"
          >
            {figures
              ? figures.map((figure) => (
                  <Box key={figure.path}>
                    <Link href={`#${figure.path}`}>
                      <Text noOfLines={1}>
                        <Icon
                          height={"15px"}
                          pt={0.5}
                          mr={0.5}
                          as={getIcon(figure)}
                        />
                        {figure.title}
                      </Text>
                    </Link>
                  </Box>
                ))
              : ""}
          </Box>
        </Box>
        <>
          {figuresPending ? (
            <Flex justify="center" align="center" height="100vh" width="full">
              <Spinner size="xl" color="ui.main" />
            </Flex>
          ) : (
            <Flex>
              <Box>
                {figures?.map((figure) => (
                  <Box id={figure.path} key={figure.title}>
                    <FigureView figure={figure} />
                  </Box>
                ))}
              </Box>
            </Flex>
          )}
        </>
      </Flex>
    </>
  )
}
