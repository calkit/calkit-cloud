import { createFileRoute } from "@tanstack/react-router"
import { Box, Container, Heading } from "@chakra-ui/react"

import { pageWidthNoSidebar } from "../../utils"

export const Route = createFileRoute("/_layout/browse")({
  component: PublicProjects,
})

function PublicProjects() {
  return (
    <Container maxW={pageWidthNoSidebar}>
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Public projects
      </Heading>
      <Box pt={5}>Coming soon!</Box>
    </Container>
  )
}
