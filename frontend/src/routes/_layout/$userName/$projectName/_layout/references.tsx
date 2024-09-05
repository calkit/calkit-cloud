import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/references",
)({
  component: () => (
    <div>Hello /_layout/$userName/$projectName/_layout/references!</div>
  ),
})
