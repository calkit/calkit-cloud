import { Modal, ModalContent, ModalOverlay } from "@chakra-ui/react"
import { createFileRoute, useRouter } from "@tanstack/react-router"

import ReleaseViewer from "../../../../../components/Releases/ReleaseViewer"

export const Route = createFileRoute(
  "/_layout/$accountName/$projectName/releases/$releaseName",
)({
  component: ReleasePage,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
})

// Reached via a share link or a release name in a table. Presented as a
// near-full-screen, closeable modal over a dimmed backdrop (not edge-to-edge
// full screen). Lives outside the project shell so no-signup share-link
// viewers aren't gated by project access; closing returns where you came from.
function ReleasePage() {
  const { accountName, projectName, releaseName } = Route.useParams()
  const { token } = Route.useSearch()
  const router = useRouter()
  const close = () => {
    if (window.history.length > 1) {
      router.history.back()
    } else {
      router.navigate({ to: `/${accountName}/${projectName}` as any })
    }
  }
  return (
    <Modal isOpen onClose={close} isCentered scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent
        maxW={{ base: "100vw", md: "92vw" }}
        w="full"
        h={{ base: "100vh", md: "92vh" }}
        m={0}
        borderRadius={{ base: 0, md: "lg" }}
        overflow="hidden"
      >
        <ReleaseViewer
          loc={{ ownerName: accountName, projectName, releaseName, token }}
          onClose={close}
        />
      </ModalContent>
    </Modal>
  )
}
