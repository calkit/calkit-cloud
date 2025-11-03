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
} from "@chakra-ui/react"
import mixpanel from "mixpanel-browser"
import { useQuery } from "@tanstack/react-query"
import { FaCheck, FaPlus } from "react-icons/fa"

import {
  zenodoAuthStateParam,
  getZenodoRedirectUri,
  getZenodoAuthUrl,
} from "../../lib/zenodo"
import { UsersService } from "../../client"
import UpdateOverleafToken from "./UpdateOverleafToken"
import { appName } from "../../lib/core"

function ConnectedAccounts() {
  const clientId = import.meta.env.VITE_ZENODO_CLIENT_ID
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
          <HStack>
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
            <Link
              isExternal
              href={`https://github.com/apps/${appName}/installations/new`}
              mt={1.5}
            >
              <Icon as={FaPlus} />
            </Link>
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
              <Icon as={FaCheck} color="green.500" />
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
