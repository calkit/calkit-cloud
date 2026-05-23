import {
  Box,
  Button,
  Code,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
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
  Switch,
  Text,
  Textarea,
  useClipboard,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type ReleasePublic, ReleasesService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"
import { releaseUrl } from "../../lib/releases"

interface NewReleaseProps {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  // Path of the artifact being released (e.g., the selected publication).
  defaultPath?: string
  // Calkit release kind; defaults to "publication".
  kind?: string
}

interface NewReleaseForm {
  name: string
  path: string
  title: string
  description: string
  git_ref: string
  public: boolean
  comments_enabled: boolean
  allow_anonymous_comments: boolean
}

const NewRelease = ({
  isOpen,
  onClose,
  ownerName,
  projectName,
  defaultPath,
  kind = "publication",
}: NewReleaseProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [created, setCreated] = useState<ReleasePublic | null>(null)
  const link = created ? releaseUrl(created.secret_token) : ""
  const { onCopy, hasCopied } = useClipboard(link)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewReleaseForm>({
    mode: "onBlur",
    defaultValues: {
      name: "",
      path: defaultPath ?? "",
      title: "",
      description: "",
      git_ref: "",
      public: false,
      comments_enabled: true,
      allow_anonymous_comments: true,
    },
  })
  // Keep the path field in sync with the prefill when the modal is (re)opened,
  // since defaultValues only apply on first mount.
  useEffect(() => {
    if (isOpen) {
      reset((prev) => ({ ...prev, path: defaultPath ?? "" }))
    }
  }, [isOpen, defaultPath, reset])
  const commentsEnabled = watch("comments_enabled")
  const mutation = useMutation({
    mutationFn: (data: NewReleaseForm) =>
      ReleasesService.postProjectRelease({
        ownerName,
        projectName,
        requestBody: {
          name: data.name,
          kind,
          path: data.path.trim() || null,
          title: data.title || null,
          description: data.description || null,
          git_ref: data.git_ref || null,
          public: data.public,
          comments_enabled: data.comments_enabled,
          allow_anonymous_comments: data.allow_anonymous_comments,
        },
      }),
    onSuccess: (data) => {
      setCreated(data)
      reset()
    },
    onError: (err: ApiError) => handleError(err, showToast),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "releases"],
      })
    },
  })
  const onSubmit: SubmitHandler<NewReleaseForm> = (data) =>
    mutation.mutate(data)

  const handleClose = () => {
    setCreated(null)
    reset()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <ModalOverlay />
      {created ? (
        <ModalContent>
          <ModalHeader>Release created</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text mb={2}>
              Share this secret link to let others view{" "}
              <Code>{created.path ?? "the project"}</Code> at{" "}
              <Code>{created.git_ref ?? created.git_rev_abbrev}</Code>:
            </Text>
            <InputGroup>
              <Input value={link} isReadOnly pr="4.5rem" />
              <InputRightElement width="4.5rem">
                <Button h="1.75rem" size="sm" onClick={onCopy}>
                  {hasCopied ? "Copied" : "Copy"}
                </Button>
              </InputRightElement>
            </InputGroup>
            {!created.public && (
              <Text mt={3} fontSize="sm" color="gray.500">
                Anyone with this link can view it, even without a Calkit
                account. The rest of your project stays private.
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      ) : (
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Create release</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.name}>
              <FormLabel htmlFor="name">Name (tag)</FormLabel>
              <Input
                id="name"
                placeholder="Ex: v0.1-draft"
                {...register("name", { required: "Name is required" })}
              />
              {errors.name && (
                <FormErrorMessage>{errors.name.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl mt={4}>
              <FormLabel htmlFor="path">Path</FormLabel>
              <Input
                id="path"
                placeholder="Ex: paper/paper.html (blank = whole project)"
                {...register("path")}
              />
              <FormHelperText>
                The file or folder to share. Leave blank to release the whole
                project.
              </FormHelperText>
            </FormControl>
            <FormControl mt={4}>
              <FormLabel htmlFor="git_ref">Git ref</FormLabel>
              <Input
                id="git_ref"
                placeholder="Tag or branch (blank = latest)"
                {...register("git_ref")}
              />
              <FormHelperText>
                The release is pinned to this commit. Leave blank to use the
                latest commit on the default branch.
              </FormHelperText>
            </FormControl>
            <FormControl mt={4}>
              <FormLabel htmlFor="title">Title</FormLabel>
              <Input id="title" placeholder="Optional" {...register("title")} />
            </FormControl>
            <FormControl mt={4}>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                placeholder="Optional"
                {...register("description")}
              />
            </FormControl>
            <FormControl mt={4} display="flex" alignItems="center">
              <Switch id="comments_enabled" {...register("comments_enabled")} />
              <FormLabel htmlFor="comments_enabled" mb={0} ml={2}>
                Allow comments
              </FormLabel>
            </FormControl>
            {commentsEnabled && (
              <FormControl mt={2} display="flex" alignItems="center">
                <Switch
                  id="allow_anonymous_comments"
                  {...register("allow_anonymous_comments")}
                />
                <FormLabel htmlFor="allow_anonymous_comments" mb={0} ml={2}>
                  Allow comments without a login
                </FormLabel>
              </FormControl>
            )}
            <FormControl mt={4} display="flex" alignItems="center">
              <Switch id="public" {...register("public")} />
              <Box ml={2}>
                <FormLabel htmlFor="public" mb={0}>
                  Public
                </FormLabel>
                <Text fontSize="xs" color="gray.500">
                  Leave off to keep this a private, link-only release.
                </Text>
              </Box>
            </FormControl>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting || mutation.isPending}
            >
              Create
            </Button>
            <Button onClick={handleClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  )
}

export default NewRelease
