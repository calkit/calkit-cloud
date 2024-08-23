import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Textarea,
  Button,
  Image,
} from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import Navbar from "../../../../../components/Common/Navbar"
import UploadFigure from "../../../../../components/Figures/UploadFigure"
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
            flexDirection={"column-reverse"}
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
    figView = <>Dunno</>
  }

  return (
    <>
      <Heading size="md" mb={2}>
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

function ProjectFiguresView() {
  const { userName, projectName } = Route.useParams()
  const { isPending: figuresPending, data: figures } = useQuery({
    queryKey: ["projects", userName, projectName, "figures"],
    queryFn: () =>
      ProjectsService.getProjectFigures({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {figuresPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          {figures?.map((figure) => (
            <Box key={figure.title}>
              <FigureView figure={figure} />
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

function ProjectFigures() {
  return (
    <>
      <Navbar type={"figure"} verb={"Upload"} addModalAs={UploadFigure} />
      <ProjectFiguresView />
      <Box mb={10} />
    </>
  )
}
