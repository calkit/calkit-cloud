import {
  Badge,
  Box,
  Flex,
  Heading,
  Icon,
  IconButton,
  Spinner,
  Text,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FaPlus, FaTag } from "react-icons/fa"
import { FiExternalLink } from "react-icons/fi"

import { ReleasesService } from "../../client"
import { releasePageUrl } from "../../lib/releases"
import NewRelease from "./NewRelease"

interface PublicationReleasesPanelProps {
  ownerName: string
  projectName: string
  path: string
  userHasWriteAccess: boolean
}

/**
 * Compact list of releases that point at a specific publication path, with a
 * shortcut to create a new one. Rendered inside the publication info panel.
 */
const PublicationReleasesPanel = ({
  ownerName,
  projectName,
  path,
  userHasWriteAccess,
}: PublicationReleasesPanelProps) => {
  const newReleaseModal = useDisclosure()
  // Shares its cache with the History page's releases table/badges.
  const releasesQuery = useQuery({
    queryKey: ["projects", ownerName, projectName, "releases", undefined],
    queryFn: () =>
      ReleasesService.getProjectReleases({ ownerName, projectName }),
  })
  // Only releases that specifically target this publication's path -- not
  // whole-project releases, which would otherwise flood every publication's
  // panel (e.g. after importing many project releases from GitHub).
  const matching = (releasesQuery.data ?? []).filter((r) => r.path === path)

  return (
    <Box mt={3}>
      <Flex align="center" mb={1}>
        <Heading size="sm">Releases</Heading>
        {userHasWriteAccess && (
          <Tooltip label="Create release of this publication">
            <IconButton
              aria-label="Create release"
              icon={<FaPlus />}
              size="xs"
              variant="primary"
              ml={2}
              onClick={newReleaseModal.onOpen}
            />
          </Tooltip>
        )}
      </Flex>
      {releasesQuery.isPending ? (
        <Spinner size="sm" color="ui.main" />
      ) : matching.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          None yet
        </Text>
      ) : (
        matching.map((r) => (
          <Flex key={`${r.source}-${r.name}`} align="center" gap={1} mb={0.5}>
            <Icon as={FaTag} fontSize="xs" color="gray.400" flexShrink={0} />
            <Text fontSize="sm" flex={1} noOfLines={1}>
              {r.name}
            </Text>
            {r.publisher && (
              <Badge colorScheme="purple" fontSize="xs" flexShrink={0}>
                {r.publisher}
              </Badge>
            )}
            <Badge
              colorScheme={r.public ? "green" : "gray"}
              fontSize="xs"
              flexShrink={0}
            >
              {r.public ? "Public" : "Private"}
            </Badge>
            {r.source === "cloud" ? (
              <Tooltip label="Open">
                <IconButton
                  as="a"
                  href={releasePageUrl(ownerName, projectName, r.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open release"
                  icon={<FiExternalLink />}
                  size="xs"
                  variant="ghost"
                  flexShrink={0}
                />
              </Tooltip>
            ) : (
              (r.url || r.doi) && (
                <Tooltip label={r.doi ?? "Open"}>
                  <IconButton
                    as="a"
                    href={r.url ?? `https://doi.org/${r.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open release link"
                    icon={<FiExternalLink />}
                    size="xs"
                    variant="ghost"
                  />
                </Tooltip>
              )
            )}
          </Flex>
        ))
      )}
      <NewRelease
        isOpen={newReleaseModal.isOpen}
        onClose={newReleaseModal.onClose}
        ownerName={ownerName}
        projectName={projectName}
        defaultPath={path}
        kind="publication"
      />
    </Box>
  )
}

export default PublicationReleasesPanel
