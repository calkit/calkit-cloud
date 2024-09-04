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
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { type SubmitHandler, useForm } from "react-hook-form"

import { ProjectsService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../utils"

interface AddCollabProps {
  isOpen: boolean
  onClose: () => void
}

interface AddCollabForm {
  github_username: string
}

const AddCollaborator = ({ isOpen, onClose }: AddCollabProps) => {
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddCollabForm>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      github_username: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: AddCollabForm) =>
      ProjectsService.putProjectCollaborator({
        githubUsername: data.github_username,
        ownerName: userName,
        projectName: projectName,
      }),
    onSuccess: () => {
      showToast("Success!", "Collaborator added successfully.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", userName, projectName, "collaborators"],
      })
    },
  })

  const onSubmit: SubmitHandler<AddCollabForm> = (data) => {
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
          <ModalHeader>Add collaborator</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.github_username}>
              <FormLabel htmlFor="github_username">GitHub username</FormLabel>
              <Input
                id="github_username"
                {...register("github_username", {
                  required: "GitHub username is required",
                })}
                placeholder="GitHub username"
                type="string"
              />
              {errors.github_username && (
                <FormErrorMessage>
                  {errors.github_username.message}
                </FormErrorMessage>
              )}
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

export default AddCollaborator
