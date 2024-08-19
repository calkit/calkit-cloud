import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/$userName/$projectName/_layout/collaborators')({
  component: () => <div>Here are the collaborators:</div>
})
