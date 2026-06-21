import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Checkbox,
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
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Text,
  Textarea,
  useClipboard,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type ReleasePublic, ReleasesService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"
import { releasePageUrl } from "../../lib/releases"
import PathPicker from "./PathPicker"

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

type Destination = "internal" | "external"

interface NewReleaseForm {
  // Where the release lives: hosted on Calkit (internal) or published to an
  // external venue.
  destination: Destination
  name: string
  path: string
  description: string
  // "internal" destination
  comments_enabled: boolean
  // Acknowledgement required when the producing stage is stale.
  acknowledge: boolean
  // "external" destination
  publisher: string
  url: string
  doi: string
  date: string
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
  // Two success shapes: a hosted link release returns a record (with a secret
  // link); an external declaration just commits to calkit.yaml.
  const [created, setCreated] = useState<ReleasePublic | null>(null)
  const [externalDone, setExternalDone] = useState(false)
  const link = created
    ? releasePageUrl(ownerName, projectName, created.name)
    : ""
  const { onCopy, hasCopied } = useClipboard(link)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NewReleaseForm>({
    mode: "onBlur",
    defaultValues: {
      destination: "internal",
      name: "",
      path: defaultPath ?? "",
      description: "",
      comments_enabled: true,
      acknowledge: false,
      publisher: "",
      url: "",
      doi: "",
      date: "",
    },
  })
  // Keep the path field in sync with the prefill when the modal is (re)opened,
  // since defaultValues only apply on first mount.
  useEffect(() => {
    if (isOpen) {
      reset((prev) => ({ ...prev, path: defaultPath ?? "" }))
    }
  }, [isOpen, defaultPath, reset])
  const destination = watch("destination")
  const path = watch("path")
  const acknowledged = watch("acknowledge")
  // Debounce the staleness lookup so we don't hit the repo on every keystroke.
  // Releases always pin to the latest commit, so staleness is checked there.
  const [stalenessPath, setStalenessPath] = useState("")
  useEffect(() => {
    const handle = setTimeout(() => {
      setStalenessPath(path.trim())
      // A new artifact means any prior acknowledgement no longer applies.
      setValue("acknowledge", false)
    }, 500)
    return () => clearTimeout(handle)
  }, [path, setValue])
  // Only internal releases of a specific path can be gated on staleness.
  const stalenessEnabled =
    isOpen && destination === "internal" && stalenessPath.length > 0
  const { data: staleness } = useQuery({
    queryKey: [
      "projects",
      ownerName,
      projectName,
      "release-staleness",
      stalenessPath,
    ],
    queryFn: () =>
      ReleasesService.getReleaseStaleness({
        ownerName,
        projectName,
        path: stalenessPath || undefined,
      }),
    enabled: stalenessEnabled,
    retry: false,
  })
  const isStale = stalenessEnabled && staleness?.up_to_date === false
  const needsAck = isStale && !acknowledged
  // Per-field opt-out for password managers (Dashlane especially keeps trying
  // to autofill even with a form-level opt-out), spread onto each text input.
  const noAutofill = {
    autoComplete: "off",
    "data-form-type": "other",
    "data-1p-ignore": true,
    "data-lpignore": "true",
  } as const

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["projects", ownerName, projectName, "releases"],
    })

  const internalMutation = useMutation({
    mutationFn: (data: NewReleaseForm) =>
      ReleasesService.postProjectRelease({
        ownerName,
        projectName,
        requestBody: {
          name: data.name,
          kind,
          path: data.path.trim() || null,
          description: data.description || null,
          // Pinned to the latest commit; private link by default (share it,
          // or make it public, afterward).
          public: false,
          comments_enabled: data.comments_enabled,
          acknowledge_non_reproducible: data.acknowledge,
        },
      }),
    onSuccess: (data) => {
      setCreated(data)
      reset()
    },
    onError: (err: ApiError) => handleError(err, showToast),
    onSettled: invalidate,
  })

  const externalMutation = useMutation({
    mutationFn: (data: NewReleaseForm) =>
      ReleasesService.postExternalRelease({
        ownerName,
        projectName,
        requestBody: {
          name: data.name,
          kind,
          path: data.path.trim() || null,
          publisher: data.publisher || null,
          url: data.url || null,
          doi: data.doi || null,
          date: data.date || null,
          description: data.description || null,
          public: true,
        },
      }),
    onSuccess: () => {
      setExternalDone(true)
      reset()
    },
    onError: (err: ApiError) => handleError(err, showToast),
    onSettled: invalidate,
  })

  const isPending = internalMutation.isPending || externalMutation.isPending
  const onSubmit: SubmitHandler<NewReleaseForm> = (data) => {
    if (data.destination === "external") {
      externalMutation.mutate(data)
    } else {
      internalMutation.mutate(data)
    }
  }

  const handleClose = () => {
    setCreated(null)
    setExternalDone(false)
    reset()
    onClose()
  }

  const renderSuccess = () => {
    if (created) {
      return (
        <ModalContent>
          <ModalHeader>Release created</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text mb={2}>
              Recorded in <Code>calkit.yaml</Code> and pushed. Open the release
              page for <Code>{created.path ?? "the project"}</Code> at{" "}
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
            <Text mt={3} fontSize="sm" color="gray.500">
              To let teammates or external reviewers view and comment without an
              account, use <b>Share</b> on the release to create an email-scoped
              link.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      )
    }
    return (
      <ModalContent>
        <ModalHeader>Release created</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Text>
            Recorded in <Code>calkit.yaml</Code> and pushed. It will appear in
            your project's releases.
          </Text>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        </ModalFooter>
      </ModalContent>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <ModalOverlay />
      {created || externalDone ? (
        renderSuccess()
      ) : (
        <ModalContent
          as="form"
          onSubmit={handleSubmit(onSubmit)}
          autoComplete="off"
          // Opt the whole form out of password managers (Dashlane, 1Password,
          // LastPass), which otherwise pop suggestions over these fields.
          data-form-type="other"
          data-1p-ignore
          data-lpignore="true"
        >
          <ModalHeader>Create release</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl>
              <FormLabel>Where</FormLabel>
              <RadioGroup
                value={destination}
                onChange={(v) => setValue("destination", v as Destination)}
              >
                <Stack direction="column" spacing={1}>
                  <Radio value="internal">
                    Internal — share via a link (hosted on Calkit)
                  </Radio>
                  <Radio value="external">
                    External — already published (arXiv, Zenodo, a journal, …)
                  </Radio>
                </Stack>
              </RadioGroup>
            </FormControl>
            <FormControl mt={4} isRequired isInvalid={!!errors.name}>
              <FormLabel htmlFor="name">Name (tag)</FormLabel>
              <Input
                id="name"
                placeholder="Ex: v1.0"
                {...register("name", { required: "Name is required" })}
                {...noAutofill}
              />
              {errors.name && (
                <FormErrorMessage>{errors.name.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl mt={4}>
              <FormLabel htmlFor="path">Path</FormLabel>
              <input type="hidden" {...register("path")} />
              <PathPicker
                ownerName={ownerName}
                projectName={projectName}
                value={path}
                onChange={(p) => setValue("path", p, { shouldDirty: true })}
              />
              <FormHelperText>
                Pick a file to release, or release the whole project.
              </FormHelperText>
            </FormControl>

            {destination === "internal" ? (
              <>
                {isStale && (
                  <Alert
                    status="warning"
                    mt={4}
                    borderRadius="md"
                    alignItems="flex-start"
                    flexDirection="column"
                  >
                    <Box display="flex">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>This artifact may be stale</AlertTitle>
                        <AlertDescription fontSize="sm">
                          {staleness?.stage ? (
                            <>
                              The pipeline stage <Code>
                                {staleness.stage}
                              </Code>{" "}
                            </>
                          ) : (
                            "The pipeline stage that produced this path "
                          )}
                          {staleness?.status === "not-run"
                            ? "has not been run, so this file may not exist or match the current code."
                            : "is out of date, so this file may not match the current code."}{" "}
                          Re-run the pipeline to be safe.
                        </AlertDescription>
                      </Box>
                    </Box>
                    <Checkbox mt={3} {...register("acknowledge")}>
                      I understand I may be sharing a non-reproducible artifact
                    </Checkbox>
                  </Alert>
                )}
              </>
            ) : (
              <>
                <FormControl mt={4}>
                  <FormLabel htmlFor="publisher">Publisher / venue</FormLabel>
                  <Input
                    id="publisher"
                    placeholder="e.g., arxiv, zenodo, or a journal name"
                    {...register("publisher")}
                    {...noAutofill}
                  />
                </FormControl>
                <FormControl mt={4}>
                  <FormLabel htmlFor="url">URL</FormLabel>
                  <Input
                    id="url"
                    placeholder="https://…"
                    {...register("url")}
                    {...noAutofill}
                  />
                </FormControl>
                <FormControl mt={4}>
                  <FormLabel htmlFor="doi">DOI</FormLabel>
                  <Input
                    id="doi"
                    placeholder="10.…"
                    {...register("doi")}
                    {...noAutofill}
                  />
                </FormControl>
                <FormControl mt={4}>
                  <FormLabel htmlFor="date">Date</FormLabel>
                  <Input id="date" type="date" {...register("date")} />
                  <FormHelperText>
                    Defaults to today if left blank.
                  </FormHelperText>
                </FormControl>
              </>
            )}

            <FormControl mt={4}>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                placeholder="Optional (Markdown supported)"
                {...register("description")}
                {...noAutofill}
              />
            </FormControl>

            {destination === "internal" && (
              <FormControl mt={4} display="flex" alignItems="center">
                <Switch
                  id="comments_enabled"
                  {...register("comments_enabled")}
                />
                <FormLabel htmlFor="comments_enabled" mb={0} ml={2}>
                  Allow comments
                </FormLabel>
              </FormControl>
            )}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting || isPending}
              isDisabled={needsAck}
            >
              Save
            </Button>
            <Button onClick={handleClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  )
}

export default NewRelease
