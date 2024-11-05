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

type OutputObject = {
  path: string
  title: string
  description: string
}

type Stage = {
  template: "py-script" | "figure-from-excel" | "word-to-pdf" | null
  name: string
  cmd: string
  out: string
  deps: Array<string> | null
  outputType: "figure" | "publication" | "dataset" | null
  outputObject: OutputObject | null
  excelChartIndex: number
}

const NewStage = ({ isOpen, onClose }: NewStageProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
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
      const postData = {
        name: data.name,
        cmd: data.cmd,
        deps: data.deps,
        outs: [data.out],
        calkit_type: data.outputType,
        calkit_object: data.outputObject,
      }
      return axios.post(url, postData)
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
  // Add a watcher for the "outputType" key so we can modify the form fields
  const watchOutputType = watch("outputType")
  const kindsWithTitle = ["publication", "figure", "dataset"]
  const watchTemplate = watch("template")

  useEffect(() => {
    if (kindsWithTitle.includes(String(watchOutputType))) {
      register("outputObject.title")
    } else {
      unregister("outputObject.title")
    }
    if (watchOutputType) {
      register("outputObject.description")
    } else {
      unregister("outputObject.description")
    }
  }, [register, unregister, watchOutputType])

  useEffect(() => {
    const template = String(watchTemplate)
    if (template === "py-script") {
      setValue("cmd", "calkit runenv python {CHANGE ME}")
    } else if (template === "figure-from-excel") {
      setValue(
        "cmd",
        "calkit excel-chart-to-png --chart-index 0 --input {CHANGE ME} --output {CHANGE ME}",
      )
      setValue("outputType", "figure")
    } else {
      setValue("cmd", "")
    }
  }, [register, unregister, watchTemplate])

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
            <FormControl isRequired isInvalid={!!errors.name} mb={2}>
              <FormLabel htmlFor="name">Name</FormLabel>
              <Input
                id="name"
                {...register("name", {})}
                placeholder="Ex: run-my-script"
              />
              {errors.name && (
                <FormErrorMessage>{errors.name.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl mb={2}>
              <FormLabel htmlFor="template">Template</FormLabel>
              <Select
                id="template"
                placeholder="Select a template..."
                {...register("template", {})}
                defaultValue=""
              >
                <option value="">None</option>
                <option value="py-script">Run Python script</option>
                <option value="figure-from-excel">Figure from Excel</option>
                <option value="word-to-pdf">Word document to PDF</option>
              </Select>
            </FormControl>
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
            <FormControl isRequired isInvalid={!!errors.out} mb={2}>
              <FormLabel htmlFor="out">Output path</FormLabel>
              <Input
                id="out"
                {...register("out", {})}
                placeholder="Ex: figures/my-figure.png"
              />
              {errors.out && (
                <FormErrorMessage>{errors.out.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl isRequired isInvalid={!!errors.outputType} mb={2}>
              <FormLabel htmlFor="outputType">Output artifact type</FormLabel>
              <Select
                id="outputType"
                {...register("outputType", {})}
                placeholder="Select a type..."
              >
                <option value="">None</option>
                <option value="figure">Figure</option>
                <option value="dataset">Dataset</option>
                <option value="publication">Publication</option>
              </Select>
              {errors.outputType && (
                <FormErrorMessage>{errors.outputType.message}</FormErrorMessage>
              )}
            </FormControl>
            {/* Add other properties depending on kind */}
            {kindsWithTitle.includes(String(watchOutputType)) ? (
              <FormControl mb={2}>
                <FormLabel htmlFor="outputObject.title">Title</FormLabel>
                <Input
                  id="outputObject.title"
                  {...register("outputObject.title", {})}
                  placeholder="Enter title..."
                />
              </FormControl>
            ) : (
              ""
            )}
            {watchOutputType ? (
              <FormControl mb={2}>
                <FormLabel htmlFor="outputObject.description">
                  Description
                </FormLabel>
                <Textarea
                  id="outputObject.description"
                  {...register("outputObject.description", {})}
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
