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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"
import { getRouteApi } from "@tanstack/react-router"

import { ProjectsService, UsersService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"

interface ImportOverleafProps {
  isOpen: boolean
  onClose: () => void
}

interface OverleafImportPost {
  path: string
  title?: string | null
  description?: string | null
  kind:
    | "journal-article"
    | "conference-paper"
    | "masters-thesis"
    | "phd-thesis"
    | "report"
    | "book"
    | "other"
  overleaf_url: string
  stage?: string | null
  environment?: string | null
  overleaf_token?: string | null
  target_path?: string | null
}

const ImportOverleaf = ({ isOpen, onClose }: ImportOverleafProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const routeApi = getRouteApi("/_layout/$accountName/$projectName")
  const { accountName, projectName } = routeApi.useParams()
  const connectedAccountsQuery = useQuery({
    queryFn: () => UsersService.getUserConnectedAccounts(),
    queryKey: ["user", "connected-accounts"],
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OverleafImportPost>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      path: "paper",
      title: null,
      description: null,
      kind: "journal-article",
      overleaf_url: undefined,
      stage: null,
      environment: null,
      overleaf_token: null,
      target_path: null,
    },
  })
  const mutation = useMutation({
    mutationFn: (data: OverleafImportPost) =>
      ProjectsService.postProjectOverleafPublication({
        requestBody: {
          overleaf_project_url: data.overleaf_url,
          title: data.title,
          path: data.path,
          target_path: data.target_path,
          description: data.description,
          kind: data.kind,
          stage_name: data.stage,
          environment_name: data.environment,
          overleaf_token: data.overleaf_token,
          sync_paths: [],
          push_paths: [],
        },
        ownerName: accountName,
        projectName: projectName,
      }),
    onSuccess: () => {
      showToast("Success!", "Overleaf project imported.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", accountName, projectName, "publications"],
      })
    },
  })
  const onSubmit: SubmitHandler<OverleafImportPost> = (data) => {
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
          <ModalHeader>Import from Overleaf</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.overleaf_url}>
              <FormLabel htmlFor="overleaf_url">Overleaf project URL</FormLabel>
              <Input
                id="overleaf_url"
                {...register("overleaf_url", {
                  required: "Overleaf project URL is required",
                })}
                placeholder={"Ex: https://www.overleaf.com/project/abc123..."}
                type="text"
              />
              {errors.overleaf_url && (
                <FormErrorMessage>
                  {errors.overleaf_url.message}
                </FormErrorMessage>
              )}
            </FormControl>
            {/* Overleaf token, if account is not yet connected */}
            {!connectedAccountsQuery.data?.overleaf ? (
              <FormControl mt={4} isRequired isInvalid={!!errors.path}>
                <FormLabel htmlFor="overleaf_token">Overleaf token</FormLabel>
                {/* TODO: Have tooltip/link here */}
                <Input
                  id="overleaf_token"
                  {...register("overleaf_token", {
                    required: "Overleaf token is required",
                  })}
                  placeholder={"Ex: olp_..."}
                  type="text"
                />
                {errors.overleaf_token && (
                  <FormErrorMessage>
                    {errors.overleaf_token.message}
                  </FormErrorMessage>
                )}
              </FormControl>
            ) : (
              ""
            )}
            {/* Destination folder */}
            <FormControl mt={4} isRequired isInvalid={!!errors.path}>
              <FormLabel htmlFor="path">Destination folder</FormLabel>
              <Input
                id="path"
                {...register("path", {
                  required: "Path is required",
                })}
                placeholder={"Ex: paper"}
                type="text"
              />
              {errors.path && (
                <FormErrorMessage>{errors.path.message}</FormErrorMessage>
              )}
            </FormControl>
            {/* Publication type */}
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
                <option value="conference-paper">Conference paper</option>
                <option value="report">Report</option>
                <option value="book">Book</option>
                <option value="masters-thesis">Master's thesis</option>
                <option value="phd-thesis">PhD thesis</option>
                <option value="other">Other</option>
              </Select>
            </FormControl>
            {/* Title */}
            <FormControl mt={4} isInvalid={!!errors.title}>
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
            {/* Target TeX file path */}
            <FormControl mt={4} isInvalid={!!errors.target_path}>
              <FormLabel htmlFor="target_path">Target TeX file path</FormLabel>
              <Input
                id="target_path"
                {...register("target_path")}
                placeholder={"Ex: main.tex"}
                type="text"
              />
              {errors.target_path && (
                <FormErrorMessage>
                  {errors.target_path.message}
                </FormErrorMessage>
              )}
            </FormControl>
            {/* Description */}
            <FormControl mt={4} isInvalid={!!errors.description}>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Description"
              />
              {errors.description && (
                <FormErrorMessage>
                  {errors.description.message}
                </FormErrorMessage>
              )}
            </FormControl>
            {/* Environment name */}
            <FormControl mt={4} isInvalid={!!errors.environment}>
              <FormLabel htmlFor="environment">
                Docker environment name
              </FormLabel>
              <Input
                id="environment"
                {...register("environment")}
                placeholder="Ex: tex"
                type="text"
              />
              {errors.environment && (
                <FormErrorMessage>
                  {errors.environment.message}
                </FormErrorMessage>
              )}
            </FormControl>
            {/* Stage name */}
            <FormControl mt={4} isInvalid={!!errors.stage}>
              <FormLabel htmlFor="stage_name">Pipeline stage name</FormLabel>
              <Input
                id="stage"
                {...register("stage")}
                placeholder="Ex: build-paper"
                type="text"
              />
              {errors.stage && (
                <FormErrorMessage>{errors.stage.message}</FormErrorMessage>
              )}
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

export default ImportOverleaf
