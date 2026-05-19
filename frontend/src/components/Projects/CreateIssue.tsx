import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Textarea,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"
import { getRouteApi } from "@tanstack/react-router"

import { type Issue, ProjectsService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"

interface CreateIssueProps {
  isOpen: boolean
  onClose: () => void
}

interface IssuePost {
  title: string
  body?: string
}

const CreateIssue = ({ isOpen, onClose }: CreateIssueProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$accountName/$projectName")
  const { accountName, projectName } = routeApi.useParams()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IssuePost>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      title: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: IssuePost) =>
      ProjectsService.postProjectIssue({
        ownerName: accountName,
        projectName: projectName,
        requestBody: data,
      }),
    onSuccess: (createdIssue) => {
      showToast("Success!", "Issue created successfully.", "success")
      reset()
      onClose()
      // Insert the new issue into the cached list directly. GitHub's REST
      // API is not immediately read-your-writes consistent, so refetching
      // here would return a stale list that omits the issue just created.
      const key = ["projects", accountName, projectName, "issues"]
      const existing = queryClient.getQueryData<Issue[]>(key)
      if (existing !== undefined) {
        queryClient.setQueryData<Issue[]>(key, [createdIssue, ...existing])
      }
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
  })

  const onSubmit: SubmitHandler<IssuePost> = (data) => {
    mutation.mutate(data)
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Create new issue</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.title}>
              <FormLabel htmlFor="title">Title</FormLabel>
              <Input
                id="title"
                {...register("title", {
                  required: "Title is required",
                })}
                placeholder="Ex: Process the data"
                type="text"
              />
              {errors.title && (
                <FormErrorMessage>{errors.title.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl mt={4}>
              <FormLabel htmlFor="body">Details</FormLabel>
              <Textarea id="body" {...register("body")} placeholder="Details" />
            </FormControl>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting || mutation.isPending}
            >
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default CreateIssue
