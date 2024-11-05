import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  Textarea,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"
import { getRouteApi } from "@tanstack/react-router"
import { useEffect } from "react"
import axios from "axios"

import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../utils"

interface NewStageProps {
  isOpen: boolean
  onClose: () => void
}

type Stage = {
  cmd: string
  outs: Array<string> | null
  deps: Array<string> | null
  kind: string
}

const NewStage = ({ isOpen, onClose }: NewStageProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
  type CalkitKind =
    | "figure"
    | "publication"
    | "dataset"
    | "environment"
    | "references"
    | null
  const {
    register,
    unregister,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Stage>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {},
  })
  const mutation = useMutation({
    mutationFn: (data: Stage) => {
      const url = `http://localhost:8866/projects/${userName}/${projectName}/pipeline/stages`
      return axios.post(url, data)
    },
    onSuccess: () => {
      showToast("Success!", "Stage added.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["local-server-main", userName, projectName, "status"],
      })
    },
  })
  const onSubmit: SubmitHandler<Stage> = (data) => {
    mutation.mutate(data)
  }
  // Add a watcher for the "kind" key so we can modify the form fields
  const watchKind = watch("kind")
  const kindsWithTitle = ["publication", "figure", "dataset"]
  const kindsWithName = ["references", "environment"]

  useEffect(() => {
    if (kindsWithTitle.includes(String(watchKind))) {
      register("attrs.title")
    } else {
      unregister("attrs.title")
    }
    if (kindsWithName.includes(String(watchKind))) {
      register("attrs.name")
    } else {
      unregister("attrs.name")
    }
    if (watchKind) {
      register("attrs.description")
    } else {
      unregister("attrs.description")
    }
  }, [register, unregister, watchKind, setValue])

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
          <ModalHeader>Add new pipeline stage</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={4}>
            <FormControl isRequired isInvalid={!!errors.cmd} mb={2}>
              <FormLabel htmlFor="cmd">Command</FormLabel>
              <Input
                id="cmd"
                {...register("cmd", {})}
                placeholder="Ex: calkit runenv python scripts/my-script.py"
              />
              {errors.cmd && (
                <FormErrorMessage>{errors.cmd.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl isRequired isInvalid={!!errors.kind} mb={2}>
              <FormLabel htmlFor="kind">Output artifact type</FormLabel>
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
            {/* Add other properties depending on kind */}
            {kindsWithTitle.includes(String(watchKind)) ? (
              <FormControl mb={2}>
                <FormLabel htmlFor="attrs.title">Title</FormLabel>
                <Input
                  id="attrs.title"
                  {...register("attrs.title", {})}
                  placeholder="Enter title..."
                />
              </FormControl>
            ) : (
              ""
            )}
            {kindsWithName.includes(String(watchKind)) ? (
              <FormControl mb={2}>
                <FormLabel htmlFor="attrs.name">Name</FormLabel>
                <Input
                  id="attrs.name"
                  {...register("attrs.name", {})}
                  placeholder="Enter name..."
                />
              </FormControl>
            ) : (
              ""
            )}
            {watchKind ? (
              <FormControl mb={2}>
                <FormLabel htmlFor="attrs.description">Description</FormLabel>
                <Textarea
                  id="attrs.description"
                  {...register("attrs.description", {})}
                  placeholder="Enter description..."
                />
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

export default NewStage
