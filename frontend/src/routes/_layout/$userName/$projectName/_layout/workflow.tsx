import { createFileRoute } from "@tanstack/react-router"
import { Box } from "@chakra-ui/react"

import Mermaid from "../../../../../components/Common/Mermaid"

// TODO: Get this diagram from the back end
const diagram = `
flowchart TD
  node1["build-paper"]
  node2["compute-coeffs"]
  node3["data/jhtdb-transitional-bl/time-ave-profiles.h5.dvc"]
  node4["extract-jhtdb-stats"]
  node5["plot-time-ave-profiles"]
  node6["run-rans-sim" <a href='./'>home</a>]
  node2-->node6
  node3-->node5
  node4-->node2
  node5-->node1
  node6-->node5
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
