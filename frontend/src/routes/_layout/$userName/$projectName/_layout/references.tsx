import { Box, Flex, Heading, useColorModeValue } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/references",
)({
  component: References,
})

function References() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")

  return (
    <>
      <Flex>
        <Box bg={secBgColor} px={4} py={2} borderRadius="lg">
          <Heading size="md">References</Heading>
        </Box>
      </Flex>
    </>
  )
}
