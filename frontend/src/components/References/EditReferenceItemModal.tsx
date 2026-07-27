import {
  Button,
  FormControl,
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
  SimpleGrid,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import {
  type ApiError,
  ProjectsService,
  type ReferenceEntry,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"

interface EditReferenceItemModalProps {
  isOpen: boolean
  onClose: () => void
  ownerName: string
  projectName: string
  bibPath: string
  // Omit to add a new item; provide to edit an existing one.
  entry?: ReferenceEntry
}

const TYPES = [
  "article",
  "book",
  "inproceedings",
  "incollection",
  "inbook",
  "phdthesis",
  "mastersthesis",
  "techreport",
  "unpublished",
  "misc",
]
// Common BibTeX fields offered in the form. Fields not listed here are left
// untouched on edit (the backend merges).
const FIELD_NAMES = [
  "title",
  "author",
  "year",
  "journal",
  "booktitle",
  "publisher",
  "volume",
  "number",
  "pages",
  "doi",
  "url",
]

const EditReferenceItemModal = ({
  isOpen,
  onClose,
  ownerName,
  projectName,
  bibPath,
  entry,
}: EditReferenceItemModalProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const isEdit = Boolean(entry)
  const [type, setType] = useState("article")
  const [key, setKey] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    setType(entry?.type ?? "article")
    setKey(entry?.key ?? "")
    const initial: Record<string, string> = {}
    for (const name of FIELD_NAMES) {
      const v = entry?.attrs?.[name]
      if (v != null) initial[name] = String(v)
    }
    setFields(initial)
  }, [isOpen, entry])
  // Whether the form differs from the entry being edited, so an unchanged edit
  // (which would be a no-op) can't be submitted. A new item is always "dirty".
  const initialFieldValue = (name: string) => {
    const v = entry?.attrs?.[name]
    return v != null ? String(v) : ""
  }
  const isDirty =
    !isEdit ||
    type !== (entry?.type ?? "article") ||
    key.trim() !== (entry?.key ?? "") ||
    FIELD_NAMES.some(
      (name) => (fields[name] ?? "").trim() !== initialFieldValue(name).trim(),
    )

  const mutation = useMutation({
    mutationFn: () => {
      const body = { path: bibPath, type, key: key.trim(), fields }
      return isEdit
        ? ProjectsService.putProjectReferenceItem({
            ownerName,
            projectName,
            bibKey: entry!.key,
            requestBody: body,
          })
        : ProjectsService.postProjectReferenceItem({
            ownerName,
            projectName,
            requestBody: body,
          })
    },
    onSuccess: () => {
      showToast(
        "Success!",
        isEdit ? "Reference updated." : "Reference added.",
        "success",
      )
      queryClient.invalidateQueries({
        queryKey: ["projects", ownerName, projectName, "references"],
      })
      onClose()
    },
    onError: (err: ApiError) => handleError(err, showToast),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent
        as="form"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault()
          if (key.trim() && isDirty) mutation.mutate()
        }}
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === "Enter" &&
            key.trim() &&
            isDirty
          ) {
            e.preventDefault()
            mutation.mutate()
          }
        }}
      >
        <ModalHeader>{isEdit ? "Edit reference" : "Add reference"}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <SimpleGrid columns={2} spacing={3}>
            <FormControl>
              <FormLabel>Type</FormLabel>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Citation key</FormLabel>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g. smith2020"
                autoComplete="off"
                data-form-type="other"
                data-lpignore="true"
              />
            </FormControl>
            {FIELD_NAMES.map((name) => (
              <FormControl key={name}>
                <FormLabel textTransform="capitalize">{name}</FormLabel>
                <Input
                  value={fields[name] ?? ""}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, [name]: e.target.value }))
                  }
                  autoComplete="off"
                  data-form-type="other"
                  data-lpignore="true"
                />
              </FormControl>
            ))}
          </SimpleGrid>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button
            variant="primary"
            type="submit"
            isDisabled={!key.trim() || !isDirty}
            isLoading={mutation.isPending}
          >
            {isEdit ? "Save" : "Add"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditReferenceItemModal
