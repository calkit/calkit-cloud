import { ExternalLinkIcon } from "@chakra-ui/icons"
import {
  Badge,
  Box,
  Button,
  Code,
  Icon,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from "@chakra-ui/react"

import type { ReleaseListItem } from "../../client"
import { releaseExternalLink } from "../../lib/releases"

interface ReleaseDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  release: ReleaseListItem | null
}

// A labeled row, rendered only when there's a value to show.
const Field = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <Box mb={3}>
    <Text fontSize="xs" color="gray.500" textTransform="uppercase">
      {label}
    </Text>
    <Box>{children}</Box>
  </Box>
)

const ReleaseDetailsModal = ({
  isOpen,
  onClose,
  release,
}: ReleaseDetailsModalProps) => {
  if (!release) return null
  const link = releaseExternalLink(release)
  const pathLabel =
    release.path && release.path !== "." ? release.path : "Whole project"
  const sourceLabel =
    release.source === "cloud"
      ? "Hosted on Calkit"
      : release.publisher
        ? `Published via ${release.publisher}`
        : "Declared in calkit.yaml"
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {release.title || release.name}
          {release.public === false && (
            <Badge ml={2} colorScheme="purple">
              Private
            </Badge>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Field label="Name">
            <Code>{release.name}</Code>
          </Field>
          {release.kind && <Field label="Kind">{release.kind}</Field>}
          <Field label="Path">
            <Code>{pathLabel}</Code>
          </Field>
          {release.git_rev_abbrev && (
            <Field label="Version">
              <Code>{release.git_ref ?? release.git_rev_abbrev}</Code>
            </Field>
          )}
          {release.date && <Field label="Date">{release.date}</Field>}
          <Field label="Source">{sourceLabel}</Field>
          {release.doi && (
            <Field label="DOI">
              <Link href={`https://doi.org/${release.doi}`} isExternal>
                {release.doi} <Icon as={ExternalLinkIcon} mx="2px" />
              </Link>
            </Field>
          )}
          {release.source === "cloud" && (
            <Field label="Activity">
              {release.view_count ?? 0} views · {release.comment_count ?? 0}{" "}
              comments
            </Field>
          )}
          {release.description && (
            <Field label="Description">
              <Text whiteSpace="pre-wrap">{release.description}</Text>
            </Field>
          )}
        </ModalBody>
        <ModalFooter gap={3}>
          {link && (
            <Button
              as={Link}
              href={link.href}
              isExternal
              variant="primary"
              rightIcon={<Icon as={ExternalLinkIcon} />}
            >
              Open {link.label}
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ReleaseDetailsModal
