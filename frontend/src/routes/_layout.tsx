import {
  Flex,
  Spinner,
  Box,
  Container,
  Text,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Heading,
  UnorderedList,
  ListItem,
  Link,
} from "@chakra-ui/react"
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import Topbar from "../components/Common/Topbar"
import { type UserPublic } from "../client"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

interface PickSubscriptionProps {
  user?: UserPublic | null
}

function PickSubscription({ user }: PickSubscriptionProps) {
  return (
    <Flex
      alignItems={"center"}
      alignContent={"center"}
      justifyContent={"center"}
      height={"100vh"}
      width={"full"}
    >
      <Box>
        <Flex justify={"center"}>
          <Heading size="lg" mb={4}>
            Choose your plan, {user?.github_username}:
          </Heading>
        </Flex>
        <Box mb={4}>
          <SimpleGrid spacing={4} columns={3}>
            {/* Free plan card */}
            <Card align={"center"}>
              <CardHeader>
                <Heading size="md">Free</Heading>
              </CardHeader>
              <CardBody>
                <UnorderedList>
                  <ListItem>1 private project</ListItem>
                  <ListItem>1 GB storage</ListItem>
                </UnorderedList>
              </CardBody>
              <CardFooter>
                <Button>Let's go!</Button>
              </CardFooter>
            </Card>
            {/* Standard plan card */}
            <Card align={"center"}>
              <CardHeader>
                <Heading size="md">Standard: $10/mo</Heading>
              </CardHeader>
              <CardBody>
                <UnorderedList>
                  <ListItem>2 private projects</ListItem>
                  <ListItem>10 GB storage</ListItem>
                </UnorderedList>
              </CardBody>
              <CardFooter>
                <Button>Let's go!</Button>
              </CardFooter>
            </Card>
            {/* Professional plan card */}
            <Card align={"center"}>
              <CardHeader>
                <Heading size="md">Professional: $50/mo</Heading>
              </CardHeader>
              <CardBody>
                <UnorderedList>
                  <ListItem>10 private projects</ListItem>
                  <ListItem>100 GB storage</ListItem>
                </UnorderedList>
              </CardBody>
              <CardFooter>
                <Button>Let's go!</Button>
              </CardFooter>
            </Card>
            {/* TODO: Enterprise/contact us card? */}
          </SimpleGrid>
        </Box>
        <Flex justifyItems={"center"} justifyContent="center" width={"100%"}>
          <Link>
            <Text justifyContent={"center"}>
              Have a discount code? Click here.
            </Text>
          </Link>
        </Flex>
      </Box>
    </Flex>
  )
}

function Layout() {
  const { isLoading, user } = useAuth()

  return (
    <Box>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <>
          {/* If the user doesn't have a subscription, they need to pick one */}
          {user?.subscription ? (
            <Box>
              <Topbar />
              <Container px={0} maxW="full">
                <Outlet />
              </Container>
            </Box>
          ) : (
            <PickSubscription user={user} />
          )}
        </>
      )}
    </Box>
  )
}
