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
  Code,
  Tooltip,
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
        {figure.content ? (
          <embed
            height="100%"
            width="100%"
            src={`data:application/pdf;base64,${figure.content}`}
          />
        ) : (
          <object
            title="content"
            data={String(figure.url)}
            height="100%"
            width="100%"
          />
        )}
      </Box>
    )
  } else if (
    figure.path.endsWith(".png") ||
    figure.path.endsWith(".jpg") ||
    figure.path.endsWith(".jpeg")
  ) {
    figView = (
      <Box width="635px">
        <Image
          alt={figure.title}
          src={
            figure.content
              ? `data:image/png;base64,${figure.content}`
              : String(figure.url)
          }
        />
      </Box>
    )
  } else {
    figView = <Text>Cannot render this type of figure</Text>
  }

  return (
    <>
      <Flex pt={1} height={"100%"}>
        <Box minW={"640px"}>
          <Heading size="md" mb={1}>
            {figure.title}
          </Heading>
          <Text>{figure.description}</Text>
          {figure.content || figure.url ? (
            <Box my={3}>{figView}</Box>
          ) : (
            "No content found"
          )}
        </Box>
        <Box mx={4} width={"100%"} maxH={"550px"} pt={1}>
          <Box mb={2}>
            <Heading size={"sm"} mb={0.5}>
              Info
            </Heading>
            <Text>
              Path:{" "}
              <Link
                as={RouterLink}
                to={"../files"}
                search={{ path: figure.path }}
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
          <Box minW="33%" maxH={"550px"}>
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
        {/* A bit of a nav bar with all the figures listed */}
        <Box>
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
            <Flex mb={2}>
              <Heading size="md">Figures</Heading>
              <Menu>
                <MenuButton
                  as={Button}
                  variant="primary"
                  height={"25px"}
                  width={"9px"}
                  px={1}
                  ml={2}
                >
                  <Icon as={FaPlus} fontSize={"xs"} />
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
            {figures
              ? figures.map((figure) => (
                  <Box key={figure.path}>
                    <Link href={`#${figure.path}`}>
                      <Tooltip
                        label={`${figure.title}: ${figure.description}`}
                        openDelay={600}
                      >
                        <Text noOfLines={1}>
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
          </Box>
        </Box>
        <>
          {figuresPending ? (
            <Flex justify="center" align="center" height="100vh" width="full">
              <Spinner size="xl" color="ui.main" />
            </Flex>
          ) : (
            <Box>
              {figures?.map((figure) => (
                <Box id={figure.path} key={figure.title}>
                  <FigureView figure={figure} />
                </Box>
              ))}
            </Box>
          )}
        </>
      </Flex>
    </>
  )
}
