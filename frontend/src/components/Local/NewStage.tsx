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
  deps: string | null // Comma-separated as input
  outputType: "figure" | "publication" | "dataset" | null
  outputObject: OutputObject | null
  excelFilePath: string | null
  excelChartIndex: number | null
  scriptPath: string | null
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
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Stage>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: { excelChartIndex: 0, excelFilePath: "{CHANGE ME}" },
  })
  const mutation = useMutation({
    mutationFn: (data: Stage) => {
      const url = `http://localhost:8866/projects/${userName}/${projectName}/pipeline/stages`
      let deps = null
      if (data.deps) {
        deps = data.deps.split(",")
      }
      const postData = {
        name: data.name,
        cmd: data.cmd,
        deps: deps,
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
  // Update output artifact form fields based on type selected
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
  // Update stage form fields based on template selected
  useEffect(() => {
    const template = String(watchTemplate)
    if (template === "py-script") {
      setValue("cmd", "calkit runenv python {CHANGE ME}")
      register("scriptPath")
      unregister("excelFilePath")
      unregister("excelChartIndex")
    } else if (template === "figure-from-excel") {
      setValue(
        "cmd",
        "calkit excel-chart-to-png {CHANGE ME} --chart-index=0 --output {CHANGE ME}",
      )
      setValue("outputType", "figure")
      setValue("excelFilePath", "")
      register("excelChartIndex")
      register("excelFilePath")
      unregister("scriptPath")
    } else if (template === "word-to-pdf") {
      setValue(
        "cmd",
        "calkit word-to-pdf {CHANGE ME}.docx --output {CHANGE ME}.pdf",
      )
      setValue("excelFilePath", "")
      register("excelFilePath")
      unregister("scriptPath")
      unregister("excelChartIndex")
    } else {
      setValue("cmd", "")
    }
  }, [register, unregister, watchTemplate, setValue])
  // If script path changes, update command automatically
  const onScriptPathChange = (e: any) => {
    const scriptPath = String(e.target.value)
    setValue("cmd", `calkit runenv python ${scriptPath}`)
    setValue("deps", scriptPath)
  }
  // If output path changes, update fields automatically
  const onOutputPathChange = (e: any) => {
    const outputPath = String(e.target.value)
    const formValues = getValues()
    if (watchTemplate === "figure-from-excel") {
      const inputPath = formValues.excelFilePath
      const idx = formValues.excelChartIndex
      const cmd = `calkit excel-chart-to-png ${inputPath} --chart-index=${idx} --output ${outputPath}`
      setValue("cmd", cmd)
    } else if (watchTemplate === "word-to-pdf") {
      const inputPath = formValues.excelFilePath
      const cmd = `calkit word-to-pdf ${inputPath} --output ${outputPath}`
      setValue("cmd", cmd)
    }
  }
  // If Excel input file path changes, update fields accordingly
  const onExcelFilePathChange = (e: any) => {
    const inputPath = String(e.target.value)
    const formValues = getValues()
    if (watchTemplate === "figure-from-excel") {
      const outputPath = formValues.out
      const idx = formValues.excelChartIndex
      const cmd = `calkit excel-chart-to-png ${inputPath} --chart-index=${idx} --output ${outputPath}`
      setValue("cmd", cmd)
      setValue("deps", inputPath)
    }
  }
  // If Word doc input file path changes, update fields accordingly
  const onWordDocFilePathChange = (e: any) => {
    const inputPath = String(e.target.value)
    const formValues = getValues()
    if (watchTemplate === "word-to-pdf") {
      const outputPath = formValues.out
      const cmd = `calkit word-to-pdf ${inputPath} --output ${outputPath}`
      setValue("cmd", cmd)
      setValue("deps", inputPath)
    }
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
            <FormControl mb={2}>
              <FormLabel htmlFor="deps">
                Input dependencies (comma-separated paths)
              </FormLabel>
              <Input
                id="deps"
                {...register("deps", {})}
                placeholder="Ex: scripts/my-script.py,data/my-data.csv"
              />
              {errors.deps && (
                <FormErrorMessage>{errors.deps.message}</FormErrorMessage>
              )}
            </FormControl>
            {/* Optional fields depending on template selected */}
            {watchTemplate === "py-script" ? (
              <FormControl isRequired isInvalid={!!errors.scriptPath} mb={2}>
                <FormLabel htmlFor="script-path">Script path</FormLabel>
                <Input
                  id="scriptPath"
                  {...register("scriptPath", {})}
                  placeholder="Ex: scripts/my-script.py"
                  onChange={onScriptPathChange}
                />
              </FormControl>
            ) : (
              ""
            )}
            {watchTemplate === "figure-from-excel" ? (
              <FormControl isRequired isInvalid={!!errors.excelFilePath} mb={2}>
                <FormLabel htmlFor="excelFilePath">Excel file path</FormLabel>
                <Input
                  id="excelFilePath"
                  {...register("excelFilePath", {})}
                  placeholder="Ex: my-excel-file.xlsx"
                  onChange={onExcelFilePathChange}
                />
              </FormControl>
            ) : (
              ""
            )}
            {watchTemplate === "word-to-pdf" ? (
              <FormControl isRequired isInvalid={!!errors.excelFilePath} mb={2}>
                <FormLabel htmlFor="excelFilePath">
                  Word document file path
                </FormLabel>
                <Input
                  id="excelFilePath"
                  {...register("excelFilePath", {})}
                  placeholder="Ex: my-document.docx"
                  onChange={onWordDocFilePathChange}
                />
              </FormControl>
            ) : (
              ""
            )}
            {/* Output path */}
            <FormControl isRequired isInvalid={!!errors.out} mb={2}>
              <FormLabel htmlFor="out">Output path</FormLabel>
              <Input
                id="out"
                {...register("out", {})}
                placeholder="Ex: figures/my-figure.png"
                onChange={onOutputPathChange}
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
