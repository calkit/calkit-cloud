import { Box, Spinner, Flex, ListItem, OrderedList } from "@chakra-ui/react"
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
      {questionsPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
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
