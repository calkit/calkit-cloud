import { createFileRoute } from "@tanstack/react-router"
import { Box, Container, Heading, Link, Text } from "@chakra-ui/react"

import { pageWidthNoSidebar } from "../../utils"

export const Route = createFileRoute("/_layout/learn")({
  component: Learn,
})

function Learn() {
  return (
    <Container maxW="800px">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Learn
      </Heading>
      <Box pt={5}>
        <Text mb={4}>
          To effectively use Calkit, you're going to want to{" "}
          <Link
            color="blue.500"
            isExternal
            href="https://github.com/calkit/calkit?tab=readme-ov-file#installation"
          >
            install the command line interface (CLI)
          </Link>{" "}
          .
        </Text>
        <Text mb={4}>
          After that check out the{" "}
          <Link
            isExternal
            color="blue.500"
            href="https://github.com/calkit/calkit?tab=readme-ov-file#tutorials"
          >
            tutorials
          </Link>
          .
        </Text>
        <Text mb={4}>
          Lastly, get in touch with the community on the{" "}
          <Link
            color="blue.500"
            isExternal
            href="https://calkit.discourse.group/"
          >
            discussion forum
          </Link>{" "}
          or on{" "}
          <Link isExternal color="blue.500" href="https://discord.gg/uhtbgXUu">
            Discord
          </Link>
          .
        </Text>
      </Box>
    </Container>
  )
}
