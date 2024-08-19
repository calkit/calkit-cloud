import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/pipelines",
)({
  component: () => (
    <div>
      A pipeline is some process run to generate an artifact (dataset, figure,
      etc.)
    </div>
  ),
})
