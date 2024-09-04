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

const AddProject = ({ isOpen, onClose }: AddProjectProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const githubUsername = currentUser?.github_username
    ? currentUser.github_username
    : "your-name"

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      description: "",
      git_repo_url: `https://github.com/${githubUsername}/`,
      is_public: false,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ProjectCreate) =>
      ProjectsService.createProject({ requestBody: data }),
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

  const onNameChange = (e: any) => {
    const projectName = String(e.target.value)
      .toLowerCase()
      .replace(/\s+/g, "-")
    const repoUrl = `https://github.com/${githubUsername}/${projectName}`
    setValue("git_repo_url", repoUrl)
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
          <ModalHeader>Create project</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.name}>
              <FormLabel htmlFor="name">Name</FormLabel>
              <Input
                id="name"
                {...register("name", {
                  required: "Name is required.",
                })}
                placeholder="Ex: Coherent structures in high Reynolds number boundary layers"
                type="text"
                onChange={onNameChange}
              />
              {errors.name && (
                <FormErrorMessage>{errors.name.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl mt={4} isInvalid={!!errors.git_repo_url}>
              <FormLabel htmlFor="git_repo_url">
                GitHub repo URL (auto-generated)
              </FormLabel>
              <Input
                id="git_repo_url"
                {...register("git_repo_url", {
                  required: "GitHub repo URL is required.",
                })}
                placeholder="Ex: https://github.com/your_name/your_repo"
                type="text"
                isDisabled
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

export default AddProject
