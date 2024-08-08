import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link,
  SkeletonText,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { ArrowForwardIcon, ExternalLinkIcon } from "@chakra-ui/icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  useNavigate,
  Link as RouterLink,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"

import { ProjectsService } from "../../client"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"
import CreateProject from "../../components/Projects/CreateProject"

export const Route = createFileRoute("/_layout/$userName/$projectName")({
  component: Project,
})

function ProjectView() {
  const queryClient = useQueryClient()
  const isPending = false

  return (
    <>
      <Box pt={5}>TODO: Add project information here</Box>
    </>
  )
}

function Project() {
  return (
    <Container maxW="full">
      <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12}>
        Project name here
      </Heading>
      <ProjectView />
    </Container>
  )
}
