import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useEffect } from "react"
import { type SubmitHandler, useFieldArray, useForm } from "react-hook-form"
import { FaPlus, FaTrash } from "react-icons/fa"

import { ProjectsService, type QuestionPublic } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { useProjectFigures, useProjectResults } from "../../hooks/useProject"
import { handleError } from "../../lib/errors"

interface EditQuestionProps {
  question: QuestionPublic | null
  isOpen: boolean
  onClose: () => void
}

interface EvidenceRow {
  // Combined "kind:path" so a single dropdown can pick figure or result.
  selection: string
  key: string
  explanation: string
}

interface EditQuestionForm {
  hypothesis: string
  answer: string
  evidence: EvidenceRow[]
}

const rowToSelection = (kind: string, path: string) => `${kind}:${path}`

const parseSelection = (selection: string) => {
  const idx = selection.indexOf(":")
  if (idx < 0) {
    return null
  }
  return {
    kind: selection.slice(0, idx) as "figure" | "result",
    path: selection.slice(idx + 1),
  }
}

const EditQuestion = ({ question, isOpen, onClose }: EditQuestionProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$accountName/$projectName")
  const { accountName, projectName } = routeApi.useParams()
  const { figuresRequest } = useProjectFigures(accountName, projectName)
  const { resultsRequest } = useProjectResults(accountName, projectName)
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<EditQuestionForm>({
    mode: "onBlur",
    defaultValues: { hypothesis: "", answer: "", evidence: [] },
  })
  const { fields, append, remove } = useFieldArray({
    control,
    name: "evidence",
  })
  // Prefill from the selected question whenever it changes.
  useEffect(() => {
    if (!question) {
      return
    }
    reset({
      hypothesis: question.hypothesis ?? "",
      answer: question.answer ?? "",
      evidence: (question.evidence ?? []).map((ev) => ({
        selection: rowToSelection(ev.kind, ev.path),
        key: ev.key ?? "",
        explanation: ev.explanation ?? "",
      })),
    })
  }, [question, reset])
  const mutation = useMutation({
    mutationFn: (data: EditQuestionForm) =>
      ProjectsService.putProjectQuestion({
        ownerName: accountName,
        projectName: projectName,
        number: Number(question?.number),
        requestBody: {
          hypothesis: data.hypothesis,
          answer: data.answer,
          evidence: data.evidence.flatMap((row) => {
            const parsed = parseSelection(row.selection)
            if (!parsed) {
              return []
            }
            return [
              {
                kind: parsed.kind,
                path: parsed.path,
                key: parsed.kind === "result" && row.key ? row.key : undefined,
                explanation: row.explanation ? row.explanation : undefined,
              },
            ]
          }),
        },
      }),
    onSuccess: () => {
      showToast("Success!", "Question updated.", "success")
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", accountName, projectName, "questions"],
      })
    },
  })
  const onSubmit: SubmitHandler<EditQuestionForm> = (data) => {
    mutation.mutate(data)
  }
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "sm", md: "lg" }}
      isCentered
    >
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader>Edit question</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {question ? (
            <Text fontSize="sm" color="gray.500" mb={4}>
              {question.question}
            </Text>
          ) : null}
          <FormControl mb={4}>
            <FormLabel htmlFor="hypothesis">Hypothesis</FormLabel>
            <Textarea
              id="hypothesis"
              {...register("hypothesis")}
              placeholder="What you expect the answer to be"
            />
          </FormControl>
          <FormControl mb={4}>
            <FormLabel htmlFor="answer">Answer</FormLabel>
            <Textarea
              id="answer"
              {...register("answer")}
              placeholder="What the project found"
            />
          </FormControl>
          <FormControl>
            <Flex align="center" mb={2}>
              <FormLabel mb={0}>Evidence</FormLabel>
              <IconButton
                aria-label="Add evidence"
                icon={<FaPlus />}
                size="xs"
                onClick={() =>
                  append({ selection: "", key: "", explanation: "" })
                }
              />
            </Flex>
            {fields.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                No evidence linked yet.
              </Text>
            ) : null}
            {fields.map((field, index) => {
              const selection = watch(`evidence.${index}.selection`)
              const parsed = parseSelection(selection || "")
              return (
                <Box
                  key={field.id}
                  borderWidth={1}
                  borderRadius="md"
                  p={3}
                  mb={2}
                >
                  <Flex gap={2} mb={2}>
                    <Select
                      {...register(`evidence.${index}.selection`)}
                      placeholder="Select a figure or result"
                      size="sm"
                    >
                      {(figuresRequest.data ?? []).length > 0 ? (
                        <optgroup label="Figures">
                          {figuresRequest.data?.map((fig) => (
                            <option
                              key={`figure:${fig.path}`}
                              value={rowToSelection("figure", fig.path)}
                            >
                              {fig.title}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {(resultsRequest.data ?? []).length > 0 ? (
                        <optgroup label="Results">
                          {resultsRequest.data?.map((res) => (
                            <option
                              key={`result:${res.path}`}
                              value={rowToSelection("result", res.path)}
                            >
                              {res.title}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </Select>
                    <IconButton
                      aria-label="Remove evidence"
                      icon={<FaTrash />}
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(index)}
                    />
                  </Flex>
                  {parsed?.kind === "result" ? (
                    <Input
                      {...register(`evidence.${index}.key`)}
                      placeholder="Key (optional), e.g. mean"
                      size="sm"
                      mb={2}
                    />
                  ) : null}
                  <Input
                    {...register(`evidence.${index}.explanation`)}
                    placeholder="Explanation (optional)"
                    size="sm"
                  />
                </Box>
              )
            })}
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
  )
}

export default EditQuestion
