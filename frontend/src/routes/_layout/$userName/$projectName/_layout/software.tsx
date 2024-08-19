import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/$userName/$projectName/_layout/software')({
  component: () => <div>Here is the software involved in this project:</div>
})
