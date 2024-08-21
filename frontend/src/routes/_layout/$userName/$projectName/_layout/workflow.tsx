import { createFileRoute } from "@tanstack/react-router"
import { Box } from "@chakra-ui/react"

import Mermaid from "../../../../../components/Common/Mermaid"

// TODO: Get this diagram from the back end
const diagram = `
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
`

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/workflow",
)({
  component: () => (
    <Box>
      This page is dedicated to describing this project's workflow. The workflow
      describes the steps that produce various artifacts, e.g., datasets,
      figures, publications.
      <Box p={5}>
        <Mermaid>{diagram}</Mermaid>
      </Box>
    </Box>
  ),
})
