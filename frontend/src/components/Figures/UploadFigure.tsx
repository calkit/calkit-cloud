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
import { type SubmitHandler, useForm } from "react-hook-form"

import { ProjectsService, type FigurePost } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../utils"

interface UploadFigureProps {
  isOpen: boolean
  onClose: () => void
}

interface FigurePostWithFile extends FigurePost {
  figure_in: FigurePost
  file: File
}

const UploadFigure = ({ isOpen, onClose }: UploadFigureProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    // getValues,
    formState: { errors, isSubmitting },
  } = useForm<FigurePostWithFile>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      figure_in: { path: "", title: "", description: "" },
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FigurePostWithFile) =>
      ProjectsService.postProjectFigure({
        formData: data,
        ownerName: "TODO",
        projectName: "TODO",
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
      queryClient.invalidateQueries({ queryKey: ["figures"] }) // TODO
    },
  })

  const onSubmit: SubmitHandler<FigurePostWithFile> = (data) => {
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
          <ModalHeader>Upload new figure</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.path}>
              <FormLabel htmlFor="path">Path (relative)</FormLabel>
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
              <Input
                id="description"
                {...register("description", {
                  required: "Description is required",
                })}
                placeholder="Description"
                type="text"
              />
              {errors.description && (
                <FormErrorMessage>
                  {errors.description.message}
                </FormErrorMessage>
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

export default UploadFigure
