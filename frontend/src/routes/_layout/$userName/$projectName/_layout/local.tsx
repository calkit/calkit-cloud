import {
  Code,
  Box,
  Text,
  Heading,
  Button,
  Spinner,
  Flex,
  Icon,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"
import { FiExternalLink } from "react-icons/fi"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/local",
)({
  component: LocalServer,
})

function LocalServer() {
  const cwdQuery = useQuery({
    queryKey: ["local-cwd"],
    queryFn: () => axios.get("http://localhost:8866/cwd"),
    retry: false,
  })
  // TODO: We should be sending some information about the project so we open
  // the correct directory
  const openVSCode = () => {
    axios.post("http://localhost:8866/open/vscode")
  }

  return (
    <>
      <Box>
        <Heading size="md" mb={1}>
          Local machine
        </Heading>
        {cwdQuery.isPending ? (
          <Flex justify="center" align="center" height="100vh" width="full">
            <Spinner size="xl" color="ui.main" />
          </Flex>
        ) : (
          <Flex>
            {!cwdQuery.error ? (
              <Box>
                <Text>
                  Current working directory: <Code>{cwdQuery?.data?.data}</Code>
                </Text>
                <Button variant="primary" onClick={openVSCode}>
                  Open in VSCode <Icon ml={1} as={FiExternalLink} />
                </Button>
              </Box>
            ) : (
              <Box>
                <Text>
                  Local server not connected. To connect your local machine, run{" "}
                  <Code>calkit server</Code> in a terminal.
                </Text>
              </Box>
            )}
          </Flex>
        )}
      </Box>
    </>
  )
}
