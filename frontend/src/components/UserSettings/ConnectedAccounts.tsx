import {
  Heading,
  HStack,
  Text,
  Icon,
  Button,
  useDisclosure,
  Flex,
  Link,
  Spinner,
  Input,
  IconButton,
} from "@chakra-ui/react"
import mixpanel from "mixpanel-browser"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { FaCheck, FaPlus, FaTimes } from "react-icons/fa"
import { MdEdit } from "react-icons/md"
import { useState } from "react"

import {
  zenodoAuthStateParam,
  getZenodoRedirectUri,
  getZenodoAuthUrl,
} from "../../lib/zenodo"
import { UsersService, type ApiError, type TokenPut } from "../../client"
import UpdateOverleafToken from "./UpdateOverleafToken"
import { appName } from "../../lib/core"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../lib/errors"

function ConnectedAccounts() {
  const clientId = import.meta.env.VITE_ZENODO_CLIENT_ID
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [isEditingOverleaf, setIsEditingOverleaf] = useState(false)
  const [overleafToken, setOverleafToken] = useState("")

  const handleConnectZenodo = () => {
    mixpanel.track("Clicked connect Zenodo")
    // TODO: Set correct redirect URI per environment
    location.href =
      `${getZenodoAuthUrl()}?client_id=${clientId}` +
      `&state=${zenodoAuthStateParam}` +
      "&scope=deposit%3Awrite+deposit%3Aactions&response_type=code" +
      `&redirect_uri=${encodeURIComponent(getZenodoRedirectUri())}`
  }
  const connectedAccountsQuery = useQuery({
    queryFn: () => UsersService.getUserConnectedAccounts(),
    queryKey: ["user", "connected-accounts"],
  })
  const ghInstallQuery = useQuery({
    queryFn: () => UsersService.getUserGithubAppInstallations(),
    queryKey: ["user", "github-app-installations"],
  })
  const overleafTokenModal = useDisclosure()

  const updateOverleafTokenMutation = useMutation({
    mutationFn: (data: TokenPut) => {
      return UsersService.putUserOverleafToken({ requestBody: data })
    },
    onSuccess: () => {
      mixpanel.track("Updated Overleaf token")
      showToast("Success!", "Overleaf token updated successfully.", "success")
      setIsEditingOverleaf(false)
      setOverleafToken("")
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["user", "connected-accounts"],
      })
    },
  })

  const handleUpdateOverleafToken = () => {
    if (overleafToken.trim()) {
      updateOverleafTokenMutation.mutate({ token: overleafToken })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUpdateOverleafToken()
    } else if (e.key === "Escape") {
      setIsEditingOverleaf(false)
      setOverleafToken("")
    }
  }

  const handleCancelEdit = () => {
    setIsEditingOverleaf(false)
    setOverleafToken("")
  }

  return (
    <>
      <Heading size="md" mb={4}>
        Connected accounts
      </Heading>
      {connectedAccountsQuery.isPending || ghInstallQuery.isPending ? (
        <Flex justify="center" align="center" height={"100vh"} width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <>
          <HStack align="center">
            <Text>GitHub:</Text>
            {connectedAccountsQuery.data?.github ? (
              <Icon as={FaCheck} color="green.500" />
            ) : (
              ""
            )}
            <Text>Installed for:</Text>
            {ghInstallQuery.data && ghInstallQuery.data.total_count > 0
              ? ghInstallQuery.data.installations.map((inst: any) => (
                  <Link
                    key={inst.id}
                    href={inst.html_url}
                    isExternal
                    variant="blue"
                  >
                    <Text key={inst.id}>{inst.account.login}</Text>
                  </Link>
                ))
              : ""}
            <IconButton
              as="a"
              href={`https://github.com/apps/${appName}/installations/new`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Add GitHub installation"
              icon={<FaPlus />}
              size="xs"
              variant="ghost"
              p={-2}
              ml={-1}
            />
          </HStack>
          <HStack mt={4}>
            <Text>Zenodo:</Text>
            {connectedAccountsQuery.data?.zenodo ? (
              <Icon as={FaCheck} color="green.500" />
            ) : (
              <Button variant="primary" size="sm" onClick={handleConnectZenodo}>
                Connect
              </Button>
            )}
          </HStack>
          <HStack mt={4}>
            <Text>Overleaf:</Text>
            {connectedAccountsQuery.data?.overleaf ? (
              <>
                <Icon as={FaCheck} color="green.500" />
                {isEditingOverleaf ? (
                  <>
                    <Input
                      size="sm"
                      placeholder="Enter new token"
                      value={overleafToken}
                      onChange={(e) => setOverleafToken(e.target.value)}
                      onKeyDown={handleKeyPress}
                      maxLength={50}
                      width="400px"
                      autoFocus
                    />
                    <IconButton
                      aria-label="Save token"
                      icon={<FaCheck />}
                      size="xs"
                      variant="primary"
                      onClick={handleUpdateOverleafToken}
                      isLoading={updateOverleafTokenMutation.isPending}
                      p={-1}
                    />
                    <IconButton
                      aria-label="Cancel"
                      icon={<FaTimes />}
                      size="xs"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      p={-1}
                    />
                  </>
                ) : (
                  <IconButton
                    aria-label="Edit token"
                    icon={<MdEdit />}
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingOverleaf(true)}
                    p={-1}
                    ml={-1}
                  />
                )}
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={overleafTokenModal.onOpen}
              >
                Connect
              </Button>
            )}
          </HStack>
          <UpdateOverleafToken
            isOpen={overleafTokenModal.isOpen}
            onClose={overleafTokenModal.onClose}
          />
        </>
      )}
    </>
  )
}

export default ConnectedAccounts
