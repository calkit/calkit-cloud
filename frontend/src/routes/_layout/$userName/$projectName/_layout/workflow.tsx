import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/workflow",
)({
  component: () => (
    <div>
      This page is dedicated to describing this project's workflow. The workflow
      describes the steps that produce various artifacts, e.g., datasets,
      figures, publications.
    </div>
  ),
})
