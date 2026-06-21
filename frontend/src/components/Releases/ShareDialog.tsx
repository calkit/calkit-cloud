import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Text,
  Tooltip,
  useClipboard,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FaTrash } from "react-icons/fa"

import { type ReleaseShareTokenCreated, ReleasesService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"
import { releasePageUrl } from "../../lib/releases"

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  releaseName: string
}

// Shows the freshly minted link once; the raw token is never retrievable again.
const MintedLink = ({
  ownerName,
  projectName,
  releaseName,
  created,
}: {
  ownerName: string
  projectName: string
  releaseName: string
  created: ReleaseShareTokenCreated
}) => {
  const url = releasePageUrl(ownerName, projectName, releaseName, created.token)
  const { onCopy, hasCopied } = useClipboard(url)
  return (
    <Box
      borderWidth="1px"
      borderColor="green.300"
      borderRadius="md"
      p={3}
      mb={4}
    >
      <Text fontSize="sm" fontWeight="semibold" mb={1}>
        Share link created
        {created.email ? (
          <>
            {" "}
            for <Code>{created.email}</Code>
          </>
        ) : null}
      </Text>
      <InputGroup size="sm">
        <Input value={url} isReadOnly pr="4rem" />
        <InputRightElement width="4rem">
          <Button h="1.5rem" size="xs" onClick={onCopy}>
            {hasCopied ? "Copied" : "Copy"}
          </Button>
        </InputRightElement>
      </InputGroup>
      <Text mt={2} fontSize="xs" color="gray.500">
        Copy it now — for security, the link can't be shown again.
      </Text>
    </Box>
  )
}

const ShareDialog = ({
  isOpen,
  onClose,
  ownerName,
  projectName,
  releaseName,
}: ShareDialogProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [email, setEmail] = useState("")
  const [permission, setPermission] = useState("comment")
  const [note, setNote] = useState("")
  const [minted, setMinted] = useState<ReleaseShareTokenCreated | null>(null)

  const sharesKey = [
    "projects",
    ownerName,
    projectName,
    "releases",
    releaseName,
    "shares",
  ]
  const sharesQuery = useQuery({
    queryKey: sharesKey,
    queryFn: () =>
      ReleasesService.listReleaseShares({
        ownerName,
        projectName,
        releaseName,
      }),
    enabled: isOpen,
  })
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: sharesKey })

  const createMutation = useMutation({
    mutationFn: () =>
      ReleasesService.createReleaseShare({
        ownerName,
        projectName,
        releaseName,
        requestBody: {
          email: email.trim() || null,
          permission: permission as "view" | "comment",
          note: note.trim() || null,
        },
      }),
    onSuccess: (data) => {
      setMinted(data)
      setEmail("")
      setNote("")
    },
    onError: (err: ApiError) => handleError(err, showToast),
    onSettled: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (tokenId: string) =>
      ReleasesService.deleteReleaseShare({
        ownerName,
        projectName,
        releaseName,
        tokenId,
      }),
    onSuccess: () =>
      showToast("Revoked", "The share link no longer works.", "success"),
    onError: (err: ApiError) => handleError(err, showToast),
    onSettled: invalidate,
  })

  const handleClose = () => {
    setMinted(null)
    setEmail("")
    setNote("")
    setPermission("comment")
    onClose()
  }

  const shares = sharesQuery.data ?? []

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Share <Code>{releaseName}</Code>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {minted && (
            <MintedLink
              ownerName={ownerName}
              projectName={projectName}
              releaseName={releaseName}
              created={minted}
            />
          )}
          <FormControl>
            <FormLabel htmlFor="share-email">
              Recipient email (optional)
            </FormLabel>
            <Input
              id="share-email"
              type="email"
              placeholder="reviewer@example.com (blank = anyone with the link)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormControl>
          <FormControl mt={3}>
            <FormLabel>Permission</FormLabel>
            <RadioGroup value={permission} onChange={setPermission}>
              <Stack direction="row" spacing={4}>
                <Radio value="comment">Can comment</Radio>
                <Radio value="view">View only</Radio>
              </Stack>
            </RadioGroup>
          </FormControl>
          <FormControl mt={3}>
            <FormLabel htmlFor="share-note">Note (optional)</FormLabel>
            <Input
              id="share-note"
              placeholder="e.g. Reviewer 2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormControl>
          <Button
            mt={4}
            size="sm"
            variant="primary"
            isLoading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create share link
          </Button>

          <Divider my={4} />
          <Text fontSize="sm" fontWeight="semibold" mb={2}>
            Existing links
          </Text>
          {sharesQuery.isPending ? (
            <Text fontSize="sm" color="gray.500">
              Loading…
            </Text>
          ) : shares.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No share links yet.
            </Text>
          ) : (
            <Stack spacing={2}>
              {shares.map((s) => (
                <Flex
                  key={s.id}
                  align="center"
                  gap={2}
                  borderWidth="1px"
                  borderRadius="md"
                  p={2}
                >
                  <Box flex={1} minW={0}>
                    <Text fontSize="sm" noOfLines={1}>
                      {s.email || "Anyone with the link"}
                      {s.note ? (
                        <Text as="span" color="gray.500">
                          {" "}
                          — {s.note}
                        </Text>
                      ) : null}
                    </Text>
                    <HStack spacing={2} mt={0.5}>
                      <Badge
                        colorScheme={
                          s.permission === "comment" ? "blue" : "gray"
                        }
                        fontSize="2xs"
                      >
                        {s.permission === "comment"
                          ? "Can comment"
                          : "View only"}
                      </Badge>
                      <Text fontSize="xs" color="gray.500">
                        {s.view_count} views
                      </Text>
                    </HStack>
                  </Box>
                  <Tooltip label="Revoke">
                    <IconButton
                      aria-label="Revoke share link"
                      icon={<FaTrash />}
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      isLoading={
                        deleteMutation.isPending &&
                        deleteMutation.variables === s.id
                      }
                      onClick={() => deleteMutation.mutate(s.id)}
                    />
                  </Tooltip>
                </Flex>
              ))}
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleClose}>Done</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ShareDialog
