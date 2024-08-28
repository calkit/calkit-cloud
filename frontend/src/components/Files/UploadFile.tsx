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

import { ProjectsService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../utils"

interface UploadFileProps {
  isOpen: boolean
  onClose: () => void
}

interface FilePost {
  path: string
  title: string
  description: string
  file: FileList
}

const UploadFile = ({ isOpen, onClose }: UploadFileProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FilePost>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      path: "",
      title: "",
      description: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FilePost) =>
      ProjectsService.postProjectFigure({
        formData: {
          title: data.title,
          path: data.path,
          description: data.description,
          file: data.file[0],
        },
        ownerName: userName,
        projectName: projectName,
      }),
    onSuccess: () => {
      showToast("Success!", "Figure uploaded successfully.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", userName, projectName, "figures"],
      })
    },
  })

  const onSubmit: SubmitHandler<FilePost> = (data) => {
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
          <ModalHeader>Upload file</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.path}>
              <FormLabel htmlFor="path">
                Path (relative to project folder)
              </FormLabel>
              <Input
                id="path"
                {...register("path", {
                  required: "Path is required",
                })}
                placeholder="Ex: figures/my-plot.png"
                type="text"
              />
              {errors.path && (
                <FormErrorMessage>{errors.path.message}</FormErrorMessage>
              )}
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
            <FormControl mt={4} isRequired isInvalid={!!errors.file}>
              <FormLabel htmlFor="file">File</FormLabel>
              <Input
                pt={1}
                id="file"
                {...register("file", {
                  required: "File is required",
                })}
                type="file"
                name="file"
              />
              {errors.file && (
                <FormErrorMessage>{errors.file.message}</FormErrorMessage>
              )}
            </FormControl>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default UploadFile
