import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"
import { getRouteApi } from "@tanstack/react-router"

import { ProjectsService, type ContentPatch, type ContentsItem } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../utils"

interface EditFileProps {
  isOpen: boolean
  onClose: () => void
  item: ContentsItem
}

const EditFileInfo = ({ isOpen, onClose, item }: EditFileProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContentPatch>({
    mode: "onBlur",
    criteriaMode: "all",
  })

  const mutation = useMutation({
    mutationFn: (data: ContentPatch) => {
      if (!data.kind) {
        data.kind = null
      }
      return ProjectsService.patchProjectContents({
        ownerName: userName,
        projectName: projectName,
        path: item.path,
        requestBody: data,
      })
    },
    onSuccess: () => {
      showToast("Success!", "File info updated.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", userName, projectName, "files"],
      })
    },
  })

  const onSubmit: SubmitHandler<ContentPatch> = (data) => {
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
          <ModalHeader>Edit artifact info</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.kind}>
              <FormLabel htmlFor="path">Artifact type</FormLabel>
              <Select
                id="kind"
                {...register("kind", {})}
                placeholder="Select a type..."
              >
                <option value="">None</option>
                <option value="figure">Figure</option>
                <option value="dataset">Dataset</option>
                <option value="publication">Publication</option>
                <option value="references">References</option>
                <option value="environment">Environment</option>
              </Select>
              {errors.kind && (
                <FormErrorMessage>{errors.kind.message}</FormErrorMessage>
              )}
            </FormControl>
            {/* TODO: Add other properties depending on kind */}
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

export default EditFileInfo
