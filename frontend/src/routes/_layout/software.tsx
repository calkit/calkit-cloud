import { createFileRoute } from "@tanstack/react-router"
import { Box, Container, Heading } from "@chakra-ui/react"

import { pageWidthNoSidebar } from "../../utils"

export const Route = createFileRoute("/_layout/software")({
  component: Software,
})

function Software() {
  return (
    <Container maxW={pageWidthNoSidebar}>
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Browse available software
      </Heading>
      <Box pt={5}>Coming soon!</Box>
    </Container>
  )
}
