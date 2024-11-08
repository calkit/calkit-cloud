import {
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Checkbox,
  Flex,
  Text,
  Heading,
} from "@chakra-ui/react"
import { useState } from "react"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { type SubmitHandler, useForm } from "react-hook-form"
import axios from "axios"

import useCustomToast from "../../hooks/useCustomToast"

interface SaveFilesProps {
  isOpen: boolean
  onClose: () => void
  changedFiles: string[]
  stagedFiles: string[]
}

interface CommitPost {
  paths: string[]
  commit_message: string
  push: boolean
}

const SaveFiles = ({
  isOpen,
  onClose,
  changedFiles,
  stagedFiles,
}: SaveFilesProps) => {
  const allPaths = changedFiles.concat(stagedFiles)
  const isCheckedInitial = Object.fromEntries(
    allPaths.map((path) => [path, true]),
  )
  const [isChecked, setIsChecked] = useState(isCheckedInitial)
  const checkBoxChange = (e: any, fpath: string) => {
    console.log("setting to", e.target.checked)
    const newValues = { ...isChecked }
    newValues[fpath] = e.target.checked
    setIsChecked(newValues)
    console.log(isChecked)
  }
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommitPost>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: { commit_message: `Update ${allPaths}`, push: true },
  })
  const mutation = useMutation({
    mutationFn: (data: CommitPost) => {
      const url = `http://localhost:8866/projects/${userName}/${projectName}/calkit/commit`
      return axios.post(url, data)
    },
    onSuccess: () => {
      showToast("Success!", "Stage added.", "success")
      reset()
      onClose()
    },
    onError: (err: any) => {
      showToast("Error", String(err.response.data.detail), "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["local-server-main", userName, projectName, "status"],
      })
      queryClient.invalidateQueries({
        queryKey: ["local-server-main", userName, projectName, "pipeline"],
      })
    },
  })
  const onSubmit: SubmitHandler<CommitPost> = (data) => {
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
          <ModalHeader>Save uncommitted file changes</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={4}>
            <Flex alignItems="center">
              <Heading size="sm" mb={1}>
                Selected files
              </Heading>
            </Flex>
            {changedFiles.map((fpath: string) => (
              <Checkbox
                key={fpath}
                colorScheme="teal"
                textColor="red.500"
                isChecked={isChecked[fpath]}
                onChange={(e) => checkBoxChange(e, fpath)}
              >
                {fpath}
              </Checkbox>
            ))}
            {stagedFiles.map((fpath: string) => (
              <Checkbox
                key={fpath}
                colorScheme="teal"
                isChecked={isChecked[fpath]}
                textColor="green.500"
                onChange={(e) => checkBoxChange(e, fpath)}
              >
                {fpath} (staged)
              </Checkbox>
            ))}
            <FormControl isRequired mb={2} mt={4}>
              <FormLabel htmlFor="commit-message">Commit message</FormLabel>
              <Input id="name" placeholder="Ex: Update test.py" />
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

export default SaveFiles
