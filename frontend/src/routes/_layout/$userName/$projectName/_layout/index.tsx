import {
  Box,
  Spinner,
  Flex,
  Heading,
  Text,
  OrderedList,
  ListItem,
  useColorModeValue,
  Checkbox,
  FormControl,
  FormLabel,
  Switch,
  Spacer,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

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
  const [showClosedTodos, setShowClosedTodos] = useState(true)
  const readmeRequest = useQuery({
    queryKey: ["projects", userName, projectName, "readme"],
    queryFn: () =>
      ProjectsService.getProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: "README.md",
      }),
  })
  const issuesRequest = useQuery({
    queryKey: ["projects", userName, projectName, "issues", showClosedTodos],
    queryFn: () =>
      ProjectsService.getProjectIssues({
        ownerName: userName,
        projectName: projectName,
        state: showClosedTodos ? "all" : "open",
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
  const onClosedTodosSwitch = (e: any) => {
    setShowClosedTodos(e.target.checked)
  }

  return (
    <>
      {readmeRequest.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Flex mt={1}>
          <Box width="60%" mr={8}>
            <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
              <Heading size="md">About</Heading>
              <Markdown>
                {removeFirstLine(atob(String(readmeRequest?.data?.content)))}
              </Markdown>
            </Box>
            {/* To-dos (issues) */}
            <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
              <Flex width="full" alignItems="center" mb={2}>
                <Box>
                  <Heading size="md">To-do</Heading>
                </Box>
                <Spacer />
                <Box>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="show-closed" mb="0">
                      Show closed
                    </FormLabel>
                    <Switch
                      id="show-closed"
                      isChecked={showClosedTodos}
                      onChange={onClosedTodosSwitch}
                    />
                  </FormControl>
                </Box>
              </Flex>
              {issuesRequest.isPending || issuesRequest.isRefetching ? (
                <Flex
                  justify="center"
                  align="center"
                  height="100%"
                  width="100%"
                >
                  <Spinner size="xl" color="ui.main" />
                </Flex>
              ) : (
                <>
                  {issuesRequest?.data?.map((issue) => (
                    <Flex
                      key={issue.number}
                      alignItems={"center"}
                      alignContent={"center"}
                    >
                      <Checkbox
                        isChecked={issue.state === "closed"}
                        isDisabled
                      />
                      <Text ml={2}> {issue.title}</Text>
                    </Flex>
                  ))}
                </>
              )}
            </Box>
          </Box>
          <Box width={"40%"}>
            <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
              <Heading size="md" mb={2}>
                Questions
              </Heading>
              <OrderedList>
                {questions?.map((question) => (
                  <ListItem key={question}>{question}</ListItem>
                ))}
              </OrderedList>
            </Box>
            <Box py={4} px={6} mb={4} borderRadius="lg" bg={secBgColor}>
              <Heading size="md" mb={2}>
                Recent activity
              </Heading>
              <Text>Bob did this...</Text>
              <Text>Joe did that...</Text>
            </Box>
            <Box py={4} px={6} borderRadius="lg" bg={secBgColor}>
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
