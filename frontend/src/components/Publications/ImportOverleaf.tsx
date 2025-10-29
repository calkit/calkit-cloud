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
  Select,
  Textarea,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"
import { getRouteApi } from "@tanstack/react-router"

import { ProjectsService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"

interface ImportOverleafProps {
  isOpen: boolean
  onClose: () => void
}

interface OverleafImportPost {
  path: string
  title: string
  description: string
  kind:
    | "journal-article"
    | "conference-paper"
    | "presentation"
    | "poster"
    | "report"
    | "book"
  template?: "latex/article" | "latex/jfm"
  stage?: string
  environment?: string
  file?: FileList
}

const ImportOverleaf = ({ isOpen, onClose }: ImportOverleafProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$accountName/$projectName")
  const { accountName, projectName } = routeApi.useParams()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OverleafImportPost>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      path: "",
      title: "",
      description: "",
    },
  })
  const mutation = useMutation({
    mutationFn: (data: OverleafImportPost) =>
      ProjectsService.postProjectPublication({
        formData: {
          title: data.title,
          path: data.path,
          description: data.description,
          kind: data.kind,
          template: data.template,
          stage: data.stage,
          environment: data.environment,
          file: data.file ? data.file[0] : null,
        },
        ownerName: accountName,
        projectName: projectName,
      }),
    onSuccess: () => {
      showToast("Success!", "Overleaf project imported.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", accountName, projectName, "publications"],
      })
    },
  })
  const onSubmit: SubmitHandler<OverleafImportPost> = (data) => {
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
          <ModalHeader>Import from Overleaf</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.path}>
              <FormLabel htmlFor="path">
                Path (subdirectory inside project)
              </FormLabel>
              <Input
                id="path"
                {...register("path", {
                  required: "Path is required",
                })}
                placeholder={"Ex: paper"}
                type="text"
              />
              {errors.path && (
                <FormErrorMessage>{errors.path.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl mt={4} isRequired isInvalid={!!errors.kind}>
              <FormLabel htmlFor="kind">Type</FormLabel>
              <Select
                id="kind"
                placeholder="Select type"
                {...register("kind", {
                  required: "Type is required",
                })}
              >
                <option value="journal-article">Journal article</option>
                <option value="presentation">Presentation</option>
                <option value="conference-paper">Conference paper</option>
                <option value="poster">Poster</option>
                <option value="report">Report</option>
                <option value="book">Book</option>
              </Select>
            </FormControl>
            <FormControl mt={4} isRequired isInvalid={!!errors.title}>
              <FormLabel htmlFor="title">Title</FormLabel>
              <Input
                id="title"
                {...register("title")}
                placeholder="Title"
                type="text"
              />
              {errors.title && (
                <FormErrorMessage>{errors.title.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl mt={4} isRequired isInvalid={!!errors.description}>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                {...register("description", {
                  required: "Description is required",
                })}
                placeholder="Description"
              />
              {errors.description && (
                <FormErrorMessage>
                  {errors.description.message}
                </FormErrorMessage>
              )}
            </FormControl>
            {/* Environment name */}
            {/* TODO: Detect if we have an environment to use already */}
            <FormControl mt={4} isRequired isInvalid={!!errors.environment}>
              <FormLabel htmlFor="environment">
                Docker environment name
              </FormLabel>
              <Input
                id="environment"
                {...register("environment")}
                placeholder="Ex: tex"
                type="text"
              />
              {errors.environment && (
                <FormErrorMessage>
                  {errors.environment.message}
                </FormErrorMessage>
              )}
            </FormControl>
            {/* Stage name */}
            <FormControl mt={4} isRequired isInvalid={!!errors.stage}>
              <FormLabel htmlFor="title">Pipeline stage name</FormLabel>
              <Input
                id="stage"
                {...register("stage")}
                placeholder="Ex: build-paper"
                type="text"
              />
              {errors.stage && (
                <FormErrorMessage>{errors.stage.message}</FormErrorMessage>
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

export default ImportOverleaf
