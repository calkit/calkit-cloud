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
import { handleError } from "../../utils"

interface UploadPublicationProps {
  isOpen: boolean
  onClose: () => void
  variant: "upload" | "label" | "template"
}

interface PublicationPostWithFile {
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
  file?: FileList
}

const NewPublication = ({
  isOpen,
  onClose,
  variant,
}: UploadPublicationProps) => {
  const uploadFile = variant === "upload"
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PublicationPostWithFile>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      path: "",
      title: "",
      description: "",
    },
  })
  const mutation = useMutation({
    mutationFn: (data: PublicationPostWithFile) =>
      ProjectsService.postProjectPublication({
        formData: {
          title: data.title,
          path: data.path,
          description: data.description,
          kind: data.kind,
          file: data.file ? data.file[0] : null,
        },
        ownerName: userName,
        projectName: projectName,
      }),
    onSuccess: () => {
      showToast("Success!", "Publication uploaded successfully.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", userName, projectName, "publications"],
      })
    },
  })
  const onSubmit: SubmitHandler<PublicationPostWithFile> = (data) => {
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
          <ModalHeader>
            {uploadFile
              ? "Upload new publication"
              : "Label existing file as publication"}
          </ModalHeader>
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
                placeholder="Ex: paper/paper.pdf"
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
            {uploadFile ? (
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
            ) : (
              ""
            )}
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

export default NewPublication
