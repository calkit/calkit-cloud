import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/environments",
)({
  component: () => <div>Here are the environments:</div>,
})
