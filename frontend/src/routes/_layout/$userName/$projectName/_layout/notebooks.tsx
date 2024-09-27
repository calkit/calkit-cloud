import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/notebooks",
)({
  component: () => (
    <div>Notebooks here!</div>
  ),
})
