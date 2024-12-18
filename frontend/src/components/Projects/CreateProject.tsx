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
  Select,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"
import mixpanel from "mixpanel-browser"
import { useNavigate } from "@tanstack/react-router"

import {
  type ApiError,
  ProjectsService,
  type ProjectCreate,
  type UserPublic,
  type ProjectPublic,
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
  const navigate = useNavigate()
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
      title: "",
      name: "",
      description: "",
      git_repo_url: `https://github.com/${githubUsername}/`,
      is_public: false,
      template: "calkit/example-basic",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ProjectCreate) => {
      if (data.template === "") {
        data.template = null
      }
      return ProjectsService.createProject({ requestBody: data })
    },
    onSuccess: (data: ProjectPublic) => {
      mixpanel.track("Created new project")
      showToast("Success!", "Project created successfully.", "success")
      const userName = String(data.git_repo_url.split("/").at(-2))
      const projectName = String(data.git_repo_url.split("/").at(-1))
      reset()
      onClose()
      navigate({
        to: "/$userName/$projectName",
        params: { userName, projectName },
      })
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

  const onTitleChange = (e: any) => {
    const projectName = String(e.target.value)
      .toLowerCase()
      .replace(/\s+/g, "-")
    const repoUrl = `https://github.com/${githubUsername}/${projectName}`
    setValue("git_repo_url", repoUrl)
    setValue("name", projectName)
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
            <FormControl isRequired isInvalid={!!errors.title}>
              <FormLabel htmlFor="title">Title</FormLabel>
              <Input
                id="name"
                {...register("title", {
                  required: "Title is required.",
                })}
                placeholder="Ex: Coherent structures in high Reynolds number boundary layers"
                type="text"
                onChange={onTitleChange}
              />
              {errors.title && (
                <FormErrorMessage>{errors.title.message}</FormErrorMessage>
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
            <FormControl mt={4}>
              <FormLabel htmlFor="template">Template</FormLabel>
              <Select
                id="template"
                placeholder="Select a template..."
                {...register("template", {})}
                defaultValue="calkit/example-basic"
              >
                <option value="calkit/example-basic">
                  calkit/example-basic
                </option>
                <option value="">None</option>
              </Select>
            </FormControl>
            <FormControl mt={4} isInvalid={!!errors.git_repo_url}>
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
