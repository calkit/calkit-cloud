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
  Flex,
  Checkbox,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
  ProjectsService,
  type ProjectCreate,
  type UserPublic,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../utils"

interface AddProjectProps {
  isOpen: boolean
  onClose: () => void
}

const CreateProjectFromGitHub = ({ isOpen, onClose }: AddProjectProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  let githubUsername = currentUser?.github_username
  if (githubUsername === null) {
    githubUsername = "your-name"
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      title: "",
      name: "",
      description: "",
      git_repo_url: `https://github.com/${githubUsername}/`,
      is_public: false,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ProjectCreate) => {
      const projectName = String(data.git_repo_url.split("/").at(-1))
      data.name = projectName
      return ProjectsService.createProject({ requestBody: data })
    },
    onSuccess: () => {
      showToast("Success!", "Project created successfully.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })

  const onSubmit: SubmitHandler<ProjectCreate> = (data) => {
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
          <ModalHeader>Import from GitHub</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.name}>
              <FormLabel htmlFor="title">Title</FormLabel>
              <Input
                id="title"
                {...register("title", {
                  required: "Title is required.",
                })}
                placeholder={
                  "Ex: Coherent structures in high Reynolds number boundary layers"
                }
                type="text"
              />
              {errors.title && (
                <FormErrorMessage>{errors.title.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl mt={4} isRequired isInvalid={!!errors.git_repo_url}>
              <FormLabel htmlFor="git_repo_url">GitHub repo URL</FormLabel>
              <Input
                id="git_repo_url"
                {...register("git_repo_url", {
                  required: "GitHub repo URL is required.",
                })}
                placeholder="Ex: https://github.com/your_name/your_repo"
                type="text"
              />
              {errors.git_repo_url && (
                <FormErrorMessage>
                  {errors.git_repo_url.message}
                </FormErrorMessage>
              )}
            </FormControl>
            <FormControl mt={4}>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Input
                id="description"
                {...register("description")}
                placeholder="Description"
                type="text"
              />
            </FormControl>
            <Flex mt={4}>
              <FormControl>
                <Checkbox {...register("is_public")} colorScheme="teal">
                  Public?
                </Checkbox>
              </FormControl>
            </Flex>
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

export default CreateProjectFromGitHub
