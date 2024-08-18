import {
  Box,
  Heading,
  Spinner,
  Flex,
  ListItem,
  OrderedList,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/questions",
)({
  component: ProjectQuestions,
})

function ProjectQuestionsView() {
  const { userName, projectName } = Route.useParams()
  const { isPending, data: project } = useQuery({
    queryKey: ["projects", userName, projectName],
    queryFn: () =>
      ProjectsService.getProjectByName({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const { isPending: questionsPending, data: questions } = useQuery({
    queryKey: ["projects", userName, projectName, "questions"],
    queryFn: () =>
      ProjectsService.getProjectQuestions({
        ownerName: userName,
        projectName: projectName,
      }),
  })

  return (
    <>
      {isPending || questionsPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <Heading
            size="lg"
            textAlign={{ base: "center", md: "left" }}
            pt={8}
            pb={3}
          >
            Questions: {project?.name}
          </Heading>
          <OrderedList>
            {questions?.map((question) => (
              <ListItem key={question.id}>{question.question}</ListItem>
            ))}
          </OrderedList>
        </Box>
      )}
    </>
  )
}

function ProjectQuestions() {
  return <ProjectQuestionsView />
}
