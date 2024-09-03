import {
  Box,
  Spinner,
  Flex,
  Heading,
  Text,
  OrderedList,
  ListItem,
  useColorModeValue,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ProjectsService } from "../../../../../client"
import Markdown from "../../../../../components/Common/Markdown"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/",
)({
  component: Project,
})

function ProjectView() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const { userName, projectName } = Route.useParams()
  const readmeRequest = useQuery({
    queryKey: ["projects", userName, projectName, "readme"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: "README.md",
      }),
  })
  const removeFirstLine = (txt: any) => {
    let lines = String(txt).split("\n")
    lines.splice(0, 1)
    return lines.join("\n")
  }
  const questions: Array<string> = [
    "Can we do something cool?",
    "Can we do something great?",
  ]

  return (
    <>
      {readmeRequest.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex mt={1}>
          <Box width="50%" mr={8}>
            <Box p={4} mb={4} borderRadius="lg" bg={secBgColor}>
              <Heading size="md">About</Heading>
              <Markdown>
                {removeFirstLine(atob(String(readmeRequest?.data?.content)))}
              </Markdown>
            </Box>
            <Box p={4} borderRadius="lg" bg={secBgColor}>
              <Heading size="md" mb={2}>
                Questions
              </Heading>
              <OrderedList>
                {questions?.map((question) => (
                  <ListItem key={question}>{question}</ListItem>
                ))}
              </OrderedList>
            </Box>
          </Box>
          <Box width={"50%"}>
            <Box p={4} mb={4} borderRadius="lg" bg={secBgColor}>
              <Heading size="md" mb={2}>
                Recent activity
              </Heading>
              <Text>Bob did this...</Text>
              <Text>Joe did that...</Text>
            </Box>
            <Box p={4} borderRadius="lg" bg={secBgColor}>
              <Heading size="md" mb={2}>
                Stats
              </Heading>
              <Text>Publications: TODO</Text>
            </Box>
          </Box>
        </Flex>
      )}
    </>
  )
}

function Project() {
  return <ProjectView />
}
