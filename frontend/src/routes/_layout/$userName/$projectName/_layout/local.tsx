import { Code, Box } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/local",
)({
  component: LocalServer,
})

function LocalServer() {
  return (
    <>
      <Box>
        To connect your local machine, run <Code>calkit server</Code> in a
        terminal.
      </Box>
    </>
  )
}
