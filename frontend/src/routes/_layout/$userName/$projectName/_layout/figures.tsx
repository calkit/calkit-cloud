import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Textarea,
  Button,
} from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

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

interface CommentsProps {
  figure: Figure
}

function FigureComments({ figure }: CommentsProps) {
  const queryClient = useQueryClient()
  const { userName, projectName } = Route.useParams()
  const {
    isPending,
    error,
    data: comments,
  } = useQuery({
    queryKey: [userName, projectName, "figure-comments"],
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
        queryKey: [userName, projectName, "figure-comments"],
      })
    },
  })
  const onButtonClick = () => {
    mutation.mutate({ figure_path: figure.path, comment: commentInput })
    setCommentInput("")
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
          <Box>
            {comments?.map((comment) => (
              <Box key={comment.id}>
                {comment.user_github_username}: {comment.comment}
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
              <Heading size="md" mb={2}>
                {figure.title}
              </Heading>
              <Text>{figure.description}</Text>
              {figure.path.endsWith(".pdf") && figure.content ? (
                <Flex my={3}>
                  <Box height="530px" width="635px">
                    <embed
                      height="100%"
                      width="100%"
                      src={`data:application/pdf;base64,${figure.content}`}
                    />
                  </Box>
                  <Box mx={4} width={"50%"}>
                    <FigureComments figure={figure} />
                  </Box>
                </Flex>
              ) : (
                "Cannot render figure content."
              )}
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

function ProjectFigures() {
  return <ProjectFiguresView />
}
