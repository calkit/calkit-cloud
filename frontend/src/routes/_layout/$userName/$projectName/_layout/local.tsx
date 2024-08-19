import { Code, Box, Text, Heading } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/local",
)({
  component: LocalServer,
})

function LocalServer() {
  const cwdQuery = useQuery({
    queryKey: ["local-cwd"],
    queryFn: () => axios.get("http://localhost:8866/cwd"),
  })

  return (
    <>
      <Box>
        <Heading size="md" mb={1}>
          Local machine
        </Heading>
        <Text>
          Current working directory: <Code>{cwdQuery?.data?.data}</Code>
        </Text>
        <Text>
          To connect your local machine, run <Code>calkit server</Code> in a
          terminal.
        </Text>
      </Box>
    </>
  )
}
