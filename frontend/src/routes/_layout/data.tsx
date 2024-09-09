import { createFileRoute } from "@tanstack/react-router"
import { Box, Container, Heading } from "@chakra-ui/react"

import { pageWidthNoSidebar } from "../../utils"

export const Route = createFileRoute("/_layout/data")({
  component: Datasets,
})

function Datasets() {
  return (
    <Container maxW={pageWidthNoSidebar}>
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Browse available datasets
      </Heading>
      <Box pt={5}>Coming soon!</Box>
    </Container>
  )
}
